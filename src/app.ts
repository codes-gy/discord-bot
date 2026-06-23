import { Client, GatewayIntentBits } from 'discord.js';
import { handleDelete } from './commands/delete';
import { handleRegister } from './commands/register';
import { handleSearch } from './commands/search';
import { handleView } from './commands/view';
import { getForumChannel } from './services/forumService';
import { env } from './utils/env';
import express from 'express';
import { handleUpdate } from './commands/update';
import { handleStats } from './commands/stats';
import { handleChangeJob } from './commands/changeJob';
import { handleCheckDuplicate } from './commands/checkDuplicate';
import { logger } from './utils/logger';
import { handleHelp } from './commands/helper';
import { handleCreatePost } from './commands/createPost';

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

        const forumChannel = await getForumChannel(client, env.forumChannelId);

        switch (interaction.commandName) {
            case '도움말':
                await handleHelp({ interaction, forumChannel });
                break;

            case '생성':
                await handleCreatePost({ interaction, forumChannel });
                break;

            case '검색':
                await handleSearch({ interaction, forumChannel });
                break;

            case '등록':
                await handleRegister({ interaction, forumChannel, client });
                break;

            case '조회':
                await handleView({ interaction, forumChannel });
                break;

            case '삭제':
                await handleDelete({ interaction, forumChannel, client });
                break;

            case '수정':
                await handleUpdate({ interaction, forumChannel, client });
                break;

            case '통계':
                await handleStats({ interaction, forumChannel });
                break;
            case '직업변경':
                await handleChangeJob({ interaction, forumChannel, client });
                break;
            case '중복검사':
                await handleCheckDuplicate({ interaction, forumChannel });
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

client.login(env.token);
