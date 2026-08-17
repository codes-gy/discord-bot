import type { VoiceState } from 'discord.js';
import { getServerQueue } from '@/services/audio/queueStore';
import { scheduleEmptyChannelLeave, clearEmptyChannelTimer } from '@/services/audio/autoLeave';
import { logger } from '@/utils/logger';

/**
 * 자원 자동 정리 (기획서 6.2): 봇이 접속한 음성 채널의 활성(비-봇) 사용자가 0명이 되면
 * 1분 뒤 자동 퇴장을 예약하고, 누군가 다시 들어오면 예약을 취소한다.
 */
export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guildId = newState.guild.id;
    const serverQueue = getServerQueue(guildId);
    if (!serverQueue) {
        return;
    }

    const botUserId = newState.client.user?.id;
    const isBotItself = botUserId !== undefined && oldState.id === botUserId;
    if (isBotItself && oldState.channelId === serverQueue.voiceChannelId && newState.channelId !== serverQueue.voiceChannelId) {
        // 봇이 강제 이동/추방된 경우: VoiceConnection의 Disconnected/Destroyed 핸들러가
        // 재연결 또는 정리를 전담하므로 여기서는 로그만 남기고 별도 처리하지 않는다.
        logger.warn(`[voiceStateUpdate] 봇이 음성 채널에서 강제로 이동되었거나 추방되었습니다 (guildId=${guildId})`);
        return;
    }

    const affectedChannelId = oldState.channelId ?? newState.channelId;
    if (affectedChannelId !== serverQueue.voiceChannelId) {
        return; // 봇이 있는 채널과 무관한 음성 상태 변경은 무시
    }

    const voiceChannel = newState.guild.channels.cache.get(serverQueue.voiceChannelId);
    if (!voiceChannel || !voiceChannel.isVoiceBased()) {
        return;
    }

    const humanMemberCount = voiceChannel.members.filter((member) => !member.user.bot).size;

    if (humanMemberCount === 0) {
        scheduleEmptyChannelLeave(guildId);
    } else {
        clearEmptyChannelTimer(guildId);
    }
}
