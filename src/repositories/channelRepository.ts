import { redisClient } from '../utils/redis';

class ChannelRepository {
    private getKey(guildId: string): string {
        return `tts:channels:${guildId}`;
    }

    // TTS 채널 등록
    async registerTtsChannel(guildId: string, channelId: string): Promise<void> {
        await redisClient.sAdd(this.getKey(guildId), channelId);
    }

    // TTS 채널 등록 해제
    async unregisterTtsChannel(guildId: string, channelId: string): Promise<void> {
        await redisClient.sRem(this.getKey(guildId), channelId);
    }

    // TTS 등록 채널 여부 확인
    async isTtsChannel(guildId: string, channelId: string): Promise<boolean> {
        const result = await redisClient.sIsMember(this.getKey(guildId), channelId);
        return Boolean(result);
    }
}

export const channelRepository = new ChannelRepository();
