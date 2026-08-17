import { TextChannel, type VoiceBasedChannel, type EmbedBuilder } from 'discord.js';
import { AudioPlayerStatus, createAudioResource, entersState } from '@discordjs/voice';
import type { QueueItem, ServerQueue } from '@/types';
import { client } from '@/libs/discordClient';
import { logger } from '@/utils/logger';
import { buildErrorEmbed, buildNowPlayingEmbed } from '@/utils/embeds';
import { getServerQueue, setServerQueue } from '@/services/audio/queueStore';
import { createPlayer, joinChannel } from '@/services/audio/connectionManager';
import { createYoutubeAudioStream } from '@/services/audio/youtubeService';
import { buildTtsAudioUrls, createTtsChunkStream } from '@/services/audio/ttsService';
import { scheduleIdleQueueLeave, clearIdleQueueTimer, clearEmptyChannelTimer, forceLeaveGuild } from '@/services/audio/autoLeave';

/**
 * 해당 길드의 ServerQueue를 가져오거나, 없으면 음성 채널에 입장해 새로 생성한다.
 * musicPlayer/ttsPlayer 두 개를 만들어 connection에는 우선 musicPlayer를 구독시킨다.
 */
export function ensureServerQueue(voiceChannel: VoiceBasedChannel, textChannelId: string): ServerQueue {
    const existing = getServerQueue(voiceChannel.guild.id);
    if (existing) {
        return existing;
    }

    const connection = joinChannel(voiceChannel);
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
}

/**
 * 음성 채널 입장(필요 시) + 대기열 등록을 함께 처리한다.
 * 재생 중인 곡도 없고 TTS도 아니라면 즉시 재생을 시작한다.
 */
export async function joinAndEnqueue(voiceChannel: VoiceBasedChannel, textChannelId: string, item: QueueItem): Promise<EnqueueResult> {
    const serverQueue = ensureServerQueue(voiceChannel, textChannelId);
    clearIdleQueueTimer(serverQueue.guildId);
    serverQueue.queue.push(item);
    const position = serverQueue.queue.length;

    const nothingPlaying = serverQueue.musicPlayer.state.status === AudioPlayerStatus.Idle && !serverQueue.currentItem;
    if (nothingPlaying && !serverQueue.isTtsPlaying) {
        await playNext(serverQueue.guildId);
        return { startedImmediately: true, position };
    }

    return { startedImmediately: false, position };
}

/**
 * 대기열에서 다음 곡을 꺼내 재생한다. 대기열이 비어 있으면 유휴 자동 퇴장 타이머를 예약한다.
 * 스트림 추출 실패 시에는 사용자에게 에러 Embed를 보낸 뒤 자동으로 다음 곡을 시도한다.
 */
export async function playNext(guildId: string): Promise<void> {
    const serverQueue = getServerQueue(guildId);
    if (!serverQueue) {
        return;
    }

    const nextItem = serverQueue.queue.shift();
    if (!nextItem) {
        serverQueue.currentItem = null;
        scheduleIdleQueueLeave(guildId);
        return;
    }

    clearIdleQueueTimer(guildId);

    try {
        const { stream, inputType } = await createYoutubeAudioStream(nextItem.url);
        const resource = createAudioResource(stream, { inputType });
        serverQueue.musicResource = resource;
        serverQueue.musicSourceStream = stream;
        serverQueue.currentItem = nextItem;
        serverQueue.musicPlayer.play(resource);
        await notifyTextChannel(serverQueue.textChannelId, buildNowPlayingEmbed(nextItem, serverQueue.queue.length));
    } catch (error) {
        logger.error(`[player] 트랙 재생 실패, 다음 곡으로 넘어갑니다 (guildId=${guildId}, url=${nextItem.url}):`, error);
        const description = error instanceof Error ? error.message : '알 수 없는 오류로 재생을 건너뛰었어요.';
        await notifyTextChannel(serverQueue.textChannelId, buildErrorEmbed(`"${nextItem.title}" 재생에 실패했어요`, description));
        await playNext(guildId);
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
    const serverQueue = ensureServerQueue(voiceChannel, textChannelId);

    clearEmptyChannelTimer(guildId);
    clearIdleQueueTimer(guildId);

    const audioUrls = buildTtsAudioUrls(text);
    if (audioUrls.length === 0) {
        return;
    }

    serverQueue.isTtsPlaying = true;
    const wasMusicPlaying = serverQueue.musicPlayer.state.status === AudioPlayerStatus.Playing;

    serverQueue.connection.subscribe(serverQueue.ttsPlayer);
    if (wasMusicPlaying) {
        serverQueue.musicPlayer.pause();
    }

    try {
        for (const audioUrl of audioUrls) {
            await playTtsChunk(serverQueue, audioUrl);
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

async function playTtsChunk(serverQueue: ServerQueue, audioUrl: string): Promise<void> {
    const { stream, inputType } = createTtsChunkStream(audioUrl);
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
