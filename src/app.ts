import { Client, GatewayIntentBits } from 'discord.js';

import { env } from './utils/env';
import express from 'express';
import { logger } from './utils/logger';
import { handleHelp } from './commands/helper';
import { connectRedis } from './utils/redis';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get('/ping', (_req, res) => {
    logger.info('ping 수신');
    res.status(200).send('pong');
});

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`웹 서버가 ${PORT} 포트에서 구동 중입니다.`);
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('clientReady', () => {
    logger.info(`젤리봇 로그인 성공: ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply({ flags: 64 });

        switch (interaction.commandName) {
            case '도움말':
                await handleHelp({ interaction });
                break;

            default:
                await interaction.editReply('지원하지 않는 명령어입니다.');
        }
    } catch (error: unknown) {
        logger.error('명령어 처리 중 오류 발생:', error);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('명령어 처리 중 오류가 발생했습니다.').catch(() => {});
            return;
        }

        await interaction
            .reply({
                content: '봇이 채널에 접근할 수 없습니다.',
            })
            .catch(() => {});
    }
});

async function start() {
    await connectRedis();
    await client.login(env.token);
}
start().then(() => {});
