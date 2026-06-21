import * as dotenv from 'dotenv';
dotenv.config();
export const env = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.APPLICATION_ID,
    forumChannelId: process.env.FORUM_CHANNEL_ID,
};
if (!env.token)
    throw new Error('DISCORD_TOKEN이 없습니다.');
if (!env.clientId)
    throw new Error('APPLICATION_ID가 없습니다.');
if (!env.forumChannelId)
    throw new Error('FORUM_CHANNEL_ID가 없습니다.');
