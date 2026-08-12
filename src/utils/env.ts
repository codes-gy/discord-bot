import * as dotenv from 'dotenv';

dotenv.config();

export const env = {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.APPLICATION_ID!,
    forumChannelId: process.env.FORUM_CHANNEL_ID!,
    MAX_DISCORD_MESSAGE_LENGTH: 1900,
    redisUrl: process.env.REDIS_URL!,
    guildId: process.env.GUILD_ID!,
};

if (!env.token) throw new Error('DISCORD_TOKEN이 없습니다.');
if (!env.clientId) throw new Error('APPLICATION_ID가 없습니다.');
