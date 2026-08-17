import {
    joinVoiceChannel,
    createAudioPlayer,
    entersState,
    VoiceConnectionStatus,
    NoSubscriberBehavior,
    type VoiceConnection,
    type AudioPlayer,
} from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';
import { logger } from '@/utils/logger';
import { getServerQueue } from '@/services/audio/queueStore';
import { forceLeaveGuild } from '@/services/audio/autoLeave';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const RECONNECT_WAIT_TIMEOUT_MS = 5000;

export function createPlayer(): AudioPlayer {
    return createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause,
        },
    });
}

/**
 * 음성 채널에 입장하고, 끊김 발생 시 지수 백오프로 자동 재연결을 시도하는 핸들러를 부착한다.
 */
export function joinChannel(voiceChannel: VoiceBasedChannel): VoiceConnection {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
    });

    attachConnectionHandlers(connection, voiceChannel.guild.id);
    return connection;
}

function attachConnectionHandlers(connection: VoiceConnection, guildId: string): void {
    connection.on(VoiceConnectionStatus.Disconnected, () => {
        void handleDisconnect(connection, guildId);
    });

    connection.on('error', (error: unknown) => {
        logger.error(`[voice] 연결 에러 (guildId=${guildId}):`, error);
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
        logger.info(`[voice] 연결이 종료되었습니다 (guildId=${guildId})`);
    });
}

async function handleDisconnect(connection: VoiceConnection, guildId: string): Promise<void> {
    try {
        // 채널 이동 등 일시적 상태 전이라면 discord.js/voice가 자체적으로 짧은 시간 내 복구한다.
        await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, RECONNECT_WAIT_TIMEOUT_MS),
            entersState(connection, VoiceConnectionStatus.Connecting, RECONNECT_WAIT_TIMEOUT_MS),
        ]);
        logger.info(`[voice] 일시적 연결 끊김에서 자동 복구되었습니다 (guildId=${guildId})`);
    } catch {
        // 자연 복구되지 않음 -> 지수 백오프 기반 수동 재연결 시도
        await attemptExponentialReconnect(connection, guildId);
    }
}

async function attemptExponentialReconnect(connection: VoiceConnection, guildId: string): Promise<void> {
    const serverQueue = getServerQueue(guildId);
    let attempts = 0;

    while (attempts < MAX_RECONNECT_ATTEMPTS) {
        if (connection.state.status === VoiceConnectionStatus.Destroyed) {
            return;
        }

        const delay = BASE_RECONNECT_DELAY_MS * 2 ** attempts;
        attempts += 1;
        if (serverQueue) {
            serverQueue.reconnectAttempts = attempts;
        }
        logger.warn(`[voice] 재연결 시도 ${attempts}/${MAX_RECONNECT_ATTEMPTS} (${delay}ms 후, guildId=${guildId})`);
        await sleep(delay);

        try {
            connection.rejoin();
            await entersState(connection, VoiceConnectionStatus.Ready, RECONNECT_WAIT_TIMEOUT_MS);
            logger.info(`[voice] 재연결에 성공했습니다 (guildId=${guildId})`);
            if (serverQueue) {
                serverQueue.reconnectAttempts = 0;
            }
            return;
        } catch (error) {
            logger.warn(`[voice] 재연결 시도 ${attempts}회차 실패 (guildId=${guildId}):`, error);
        }
    }

    logger.error(`[voice] 재연결을 ${MAX_RECONNECT_ATTEMPTS}회 시도했지만 모두 실패했습니다 (guildId=${guildId})`);
    await forceLeaveGuild(
        guildId,
        '음성 연결이 끊겨 자동 퇴장했어요',
        '네트워크 문제로 재연결에 계속 실패해 음성 채널에서 나갔어요. 잠시 후 `/재생`으로 다시 시도해주세요.'
    );
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
