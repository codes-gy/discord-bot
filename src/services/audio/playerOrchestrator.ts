import { TextChannel, type VoiceBasedChannel, type EmbedBuilder } from 'discord.js';
import { AudioPlayerStatus, createAudioResource, entersState } from '@discordjs/voice';
import type { QueueItem, ServerQueue } from '@/types';
import { client } from '@/libs/discordClient';
import { logger } from '@/utils/logger';
import { buildErrorEmbed, buildNowPlayingEmbed } from '@/utils/embeds';
import { getServerQueue, setServerQueue } from '@/services/audio/queueStore';
import { createPlayer, joinChannel } from '@/services/audio/connectionManager';
import { createYoutubeAudioStream } from '@/services/audio/youtubeService';
import { buildTtsAudioChunks, createTtsChunkStream } from '@/services/audio/ttsService';
import { scheduleIdleQueueLeave, clearIdleQueueTimer, clearEmptyChannelTimer, forceLeaveGuild } from '@/services/audio/autoLeave';

/**
 * 해당 길드의 ServerQueue를 가져오거나, 없으면 음성 채널에 입장해 새로 생성한다.
 * musicPlayer/ttsPlayer 두 개를 만들어 connection에는 우선 musicPlayer를 구독시킨다.
 */
export async function ensureServerQueue(voiceChannel: VoiceBasedChannel, textChannelId: string): Promise<ServerQueue> {
    const existing = getServerQueue(voiceChannel.guild.id);
    if (existing) {
        return existing;
    }

    const connection = await joinChannel(voiceChannel);
    const musicPlayer = createPlayer();
    const ttsPlayer = createPlayer();
    connection.subscribe(musicPlayer);

    const serverQueue: ServerQueue = {
        guildId: voiceChannel.guild.id,
        textChannelId,
        voiceChannelId: voiceChannel.id,
        connection,
        musicPlayer,
        ttsPlayer,
        musicResource: null,
        musicSourceStream: null,
        currentItem: null,
        queue: [],
        isTtsPlaying: false,
        idleLeaveTimer: null,
        emptyChannelTimer: null,
        reconnectAttempts: 0,
    };

    attachMusicPlayerLifecycle(serverQueue);
    setServerQueue(voiceChannel.guild.id, serverQueue);
    return serverQueue;
}

function attachMusicPlayerLifecycle(serverQueue: ServerQueue): void {
    serverQueue.musicPlayer.on('stateChange', (oldState, newState) => {
        if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
            destroyMusicResource(serverQueue);
            void playNext(serverQueue.guildId);
        }
    });

    serverQueue.musicPlayer.on('error', (error) => {
        logger.error(`[player] 음악 재생 중 에러 발생 (guildId=${serverQueue.guildId}):`, error);
        destroyMusicResource(serverQueue);
        void playNext(serverQueue.guildId);
    });

    serverQueue.ttsPlayer.on('error', (error) => {
        logger.error(`[player] TTS 재생 중 에러 발생 (guildId=${serverQueue.guildId}):`, error);
    });

    // 실제로 오디오가 몇 ms나 재생됐는지 로그로 남긴다. playbackDuration이 비정상적으로 짧다면
    // (예: 0ms에 가깝게 Idle로 바로 전이) 리소스는 만들어졌지만 실제 오디오 데이터는 전달되지 않았다는 뜻이라
    // 연결/구독 문제를 구분하는 데 중요한 단서가 된다.
    serverQueue.ttsPlayer.on('stateChange', (oldState, newState) => {
        logger.info(
            `[tts] ttsPlayer 상태 변화 (guildId=${serverQueue.guildId}): ${oldState.status} -> ${newState.status}` +
                (oldState.status === AudioPlayerStatus.Playing && 'playbackDuration' in oldState
                    ? ` (재생 시간: ${oldState.playbackDuration}ms)`
                    : '')
        );
    });
}

function destroyMusicResource(serverQueue: ServerQueue): void {
    try {
        serverQueue.musicSourceStream?.destroy();
    } catch (error) {
        logger.error(`[player] 오디오 리소스 정리 실패 (guildId=${serverQueue.guildId}):`, error);
    }
    serverQueue.musicResource = null;
    serverQueue.musicSourceStream = null;
    serverQueue.currentItem = null;
}

export interface EnqueueResult {
    startedImmediately: boolean;
    position: number;
    /** startedImmediately가 true일 때, 실제로 재생을 시작한 곡. 스트림 추출이 전부 실패하면 null. */
    startedItem?: QueueItem | null;
    /** startedImmediately가 true일 때, 재생 시작 직후 남은 대기열 곡 수. */
    remainingInQueue?: number;
}

/**
 * 음성 채널 입장(필요 시) + 대기열 등록을 함께 처리한다.
 * 재생 중인 곡도 없고 TTS도 아니라면 즉시 재생을 시작한다.
 * 이때는 playNext의 채널 알림을 끄고(notify: false) 호출부(커맨드)가 실제로 재생된 곡 정보를 받아
 * 자신의 interaction 응답으로만 안내한다 — 그렇지 않으면 "재생을 시작했어요" Embed가
 * (interaction 응답 + playNext의 채널 메시지) 두 번 표시된다.
 */
export async function joinAndEnqueue(voiceChannel: VoiceBasedChannel, textChannelId: string, item: QueueItem): Promise<EnqueueResult> {
    const serverQueue = await ensureServerQueue(voiceChannel, textChannelId);
    clearIdleQueueTimer(serverQueue.guildId);
    serverQueue.queue.push(item);
    const position = serverQueue.queue.length;

    const nothingPlaying = serverQueue.musicPlayer.state.status === AudioPlayerStatus.Idle && !serverQueue.currentItem;
    if (nothingPlaying && !serverQueue.isTtsPlaying) {
        const startedItem = await playNext(serverQueue.guildId, { notify: false });
        return { startedImmediately: true, position, startedItem, remainingInQueue: serverQueue.queue.length };
    }

    return { startedImmediately: false, position };
}

export interface PlayNextOptions {
    /** 재생 시작/실패를 텍스트 채널에 알릴지 여부. 기본값 true. /재생 커맨드의 즉시재생 경로에서만 false로 넘긴다. */
    notify?: boolean;
}

/**
 * 대기열에서 다음 곡을 꺼내 재생한다. 대기열이 비어 있으면 유휴 자동 퇴장 타이머를 예약한다.
 * 스트림 추출 실패 시에는(notify가 true일 때) 사용자에게 에러 Embed를 보낸 뒤 자동으로 다음 곡을 시도한다.
 * 실제로 재생을 시작한 곡(QueueItem)을 반환하며, 대기열이 비어있거나 모든 후보가 실패하면 null을 반환한다.
 */
export async function playNext(guildId: string, options: PlayNextOptions = {}): Promise<QueueItem | null> {
    const notify = options.notify ?? true;
    const serverQueue = getServerQueue(guildId);
    if (!serverQueue) {
        return null;
    }

    const nextItem = serverQueue.queue.shift();
    if (!nextItem) {
        serverQueue.currentItem = null;
        scheduleIdleQueueLeave(guildId);
        return null;
    }

    clearIdleQueueTimer(guildId);

    try {
        const { stream, inputType } = await createYoutubeAudioStream(nextItem.url);
        const resource = createAudioResource(stream, { inputType });
        serverQueue.musicResource = resource;
        serverQueue.musicSourceStream = stream;
        serverQueue.currentItem = nextItem;
        serverQueue.musicPlayer.play(resource);
        if (notify) {
            await notifyTextChannel(serverQueue.textChannelId, buildNowPlayingEmbed(nextItem, serverQueue.queue.length));
        }
        return nextItem;
    } catch (error) {
        logger.error(`[player] 트랙 재생 실패, 다음 곡으로 넘어갑니다 (guildId=${guildId}, url=${nextItem.url}):`, error);
        if (notify) {
            const description = error instanceof Error ? error.message : '알 수 없는 오류로 재생을 건너뛰었어요.';
            await notifyTextChannel(serverQueue.textChannelId, buildErrorEmbed(`"${nextItem.title}" 재생에 실패했어요`, description));
        }
        return playNext(guildId, options);
    }
}

/**
 * /정지: 재생 중단 및 대기열 완전 초기화. 연결 자체는 유지하고(원하면 다시 /재생 가능), 유휴 자동 퇴장 타이머만 예약한다.
 */
export function stopAndClearQueue(guildId: string): boolean {
    const serverQueue = getServerQueue(guildId);
    if (!serverQueue) {
        return false;
    }
    clearIdleQueueTimer(guildId);
    serverQueue.queue = [];
    destroyMusicResource(serverQueue);
    serverQueue.musicPlayer.stop(true);
    scheduleIdleQueueLeave(guildId);
    return true;
}

/**
 * /퇴장: 연결 해제 및 서버 대기열 메모리 완전 해제.
 */
export async function leaveGuild(guildId: string): Promise<boolean> {
    const existed = Boolean(getServerQueue(guildId));
    if (existed) {
        await forceLeaveGuild(guildId);
    }
    return existed;
}

/**
 * TTS 인터럽트 오케스트레이션 (기획서 F-05):
 * 1) 필요 시 발화자의 음성 채널에 입장
 * 2) 음악이 재생 중이면 connection 구독을 ttsPlayer로 스위칭 + musicPlayer 일시정지
 * 3) google-tts-api 청크를 순차 재생
 * 4) 종료 후 connection 구독을 musicPlayer로 되돌리고 재개(unpause는 재생 중이 아니었다면 안전하게 무시됨)
 */
export async function interruptWithTts(voiceChannel: VoiceBasedChannel, textChannelId: string, text: string): Promise<void> {
    const guildId = voiceChannel.guild.id;
    const serverQueue = await ensureServerQueue(voiceChannel, textChannelId);

    clearEmptyChannelTimer(guildId);
    clearIdleQueueTimer(guildId);

    const audioChunks = await buildTtsAudioChunks(text);
    if (audioChunks.length === 0) {
        return;
    }

    serverQueue.isTtsPlaying = true;
    const wasMusicPlaying = serverQueue.musicPlayer.state.status === AudioPlayerStatus.Playing;

    serverQueue.connection.subscribe(serverQueue.ttsPlayer);
    if (wasMusicPlaying) {
        serverQueue.musicPlayer.pause();
    }

    try {
        for (const base64Audio of audioChunks) {
            await playTtsChunk(serverQueue, base64Audio);
        }
    } catch (error) {
        logger.error(`[tts] TTS 재생 중 오류가 발생했습니다 (guildId=${guildId}):`, error);
        await notifyTextChannel(
            textChannelId,
            buildErrorEmbed('TTS 재생에 실패했어요', error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.')
        );
    } finally {
        serverQueue.isTtsPlaying = false;
        serverQueue.connection.subscribe(serverQueue.musicPlayer);
        if (serverQueue.currentItem) {
            serverQueue.musicPlayer.unpause();
        } else {
            scheduleIdleQueueLeave(guildId);
        }
    }
}

async function playTtsChunk(serverQueue: ServerQueue, base64Audio: string): Promise<void> {
    const { stream, inputType } = createTtsChunkStream(base64Audio);
    const resource = createAudioResource(stream, { inputType });

    try {
        serverQueue.ttsPlayer.play(resource);
        await entersState(serverQueue.ttsPlayer, AudioPlayerStatus.Playing, 5_000);
        await entersState(serverQueue.ttsPlayer, AudioPlayerStatus.Idle, 30_000);
    } finally {
        stream.destroy();
    }
}

async function notifyTextChannel(channelId: string, embed: EmbedBuilder): Promise<void> {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel instanceof TextChannel) {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        logger.error(`[player] 텍스트 채널(${channelId}) 알림 전송 실패:`, error);
    }
}
