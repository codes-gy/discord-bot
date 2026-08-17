import { TextChannel } from 'discord.js';
import { VoiceConnectionStatus } from '@discordjs/voice';
import { client } from '@/libs/discordClient';
import { logger } from '@/utils/logger';
import { buildEmptyStateEmbed } from '@/utils/embeds';
import { getServerQueue, deleteServerQueue } from '@/services/audio/queueStore';

const IDLE_QUEUE_LEAVE_MS = 3 * 60 * 1000; // 대기열이 빈 채로 3분 경과 시 퇴장 (기획서 F-03)
const EMPTY_CHANNEL_LEAVE_MS = 60 * 1000; // 음성 채널에 활성 사용자가 0명일 때 1분 후 퇴장 (기획서 6.2)

/**
 * 연결/플레이어를 정리하고 스토어에서 서버 상태를 제거한다.
 * 재연결 최종 실패, 대기열 유휴, 빈 채널 등 모든 "퇴장" 경로가 이 함수 하나로 수렴한다.
 */
export async function forceLeaveGuild(guildId: string, notifyTitle?: string, notifyDescription?: string): Promise<void> {
    const serverQueue = getServerQueue(guildId);
    if (!serverQueue) {
        return;
    }

    clearIdleQueueTimer(serverQueue.guildId);
    clearEmptyChannelTimer(serverQueue.guildId);

    try {
        serverQueue.musicSourceStream?.destroy();
    } catch (error) {
        logger.error(`[autoLeave] 오디오 소스 스트림 정리 실패 (guildId=${guildId}):`, error);
    }

    try {
        serverQueue.musicPlayer.stop(true);
        serverQueue.ttsPlayer.stop(true);
    } catch (error) {
        logger.error(`[autoLeave] 플레이어 정지 실패 (guildId=${guildId}):`, error);
    }

    try {
        if (serverQueue.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            serverQueue.connection.destroy();
        }
    } catch (error) {
        logger.error(`[autoLeave] 음성 연결 정리 실패 (guildId=${guildId}):`, error);
    }

    deleteServerQueue(guildId);
    logger.info(`[autoLeave] 서버 큐 정리 및 음성 채널 퇴장 완료 (guildId=${guildId})`);

    if (notifyTitle && notifyDescription) {
        await notifyTextChannel(serverQueue.textChannelId, notifyTitle, notifyDescription);
    }
}

async function notifyTextChannel(channelId: string, title: string, description: string): Promise<void> {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel instanceof TextChannel) {
            await channel.send({ embeds: [buildEmptyStateEmbed(title, description)] });
        }
    } catch (error) {
        logger.error(`[autoLeave] 텍스트 채널 알림 전송 실패 (channelId=${channelId}):`, error);
    }
}

export function scheduleIdleQueueLeave(guildId: string): void {
    const serverQueue = getServerQueue(guildId);
    if (!serverQueue) {
        return;
    }
    clearIdleQueueTimer(guildId);
    serverQueue.idleLeaveTimer = setTimeout(() => {
        void forceLeaveGuild(
            guildId,
            '대기열이 비어 자동 퇴장했어요',
            '3분 동안 재생할 곡이 없어 음성 채널에서 나갔어요. `/재생`으로 다시 불러주세요!'
        );
    }, IDLE_QUEUE_LEAVE_MS);
}

export function clearIdleQueueTimer(guildId: string): void {
    const serverQueue = getServerQueue(guildId);
    if (serverQueue?.idleLeaveTimer) {
        clearTimeout(serverQueue.idleLeaveTimer);
        serverQueue.idleLeaveTimer = null;
    }
}

export function scheduleEmptyChannelLeave(guildId: string): void {
    const serverQueue = getServerQueue(guildId);
    if (!serverQueue) {
        return;
    }
    clearEmptyChannelTimer(guildId);
    serverQueue.emptyChannelTimer = setTimeout(() => {
        void forceLeaveGuild(guildId, '음성 채널에 아무도 없어 자동 퇴장했어요', '1분 동안 음성 채널에 사용자가 없어 나갔어요.');
    }, EMPTY_CHANNEL_LEAVE_MS);
}

export function clearEmptyChannelTimer(guildId: string): void {
    const serverQueue = getServerQueue(guildId);
    if (serverQueue?.emptyChannelTimer) {
        clearTimeout(serverQueue.emptyChannelTimer);
        serverQueue.emptyChannelTimer = null;
    }
}
