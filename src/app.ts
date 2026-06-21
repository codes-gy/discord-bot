import { Client, GatewayIntentBits } from 'discord.js';
import { handleDelete } from './commands/delete';
import { handleRegister } from './commands/register';
import { handleSearch } from './commands/search';
import { handleView } from './commands/view';
import { getForumChannel } from './services/forumService';
import { env } from './utils/env';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('ready', () => {
    console.log(`젤리봇 로그인 성공: ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const forumChannel = await getForumChannel(client, env.forumChannelId);

        switch (interaction.commandName) {
            case '검색':
                await handleSearch({
                    interaction,
                    forumChannel,
                });
                break;

            case '등록':
                await handleRegister({
                    interaction,
                    forumChannel,
                    client,
                });
                break;

            case '조회':
                await handleView({
                    interaction,
                    forumChannel,
                });
                break;

            case '삭제':
                await handleDelete({
                    interaction,
                    forumChannel,
                    client,
                });
                break;

            default:
                await interaction.reply({
                    content: '지원하지 않는 명령어입니다.',
                    ephemeral: true,
                });
        }
    } catch (error: unknown) {
        console.error('명령어 처리 중 오류 발생:', error);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('명령어 처리 중 오류가 발생했습니다.');
            return;
        }

        await interaction.reply({
            content: '봇이 대상 포럼 채널에 접근할 수 없습니다. 채널 권한을 확인해 주세요.',
            ephemeral: true,
        });
    }
});

client.login(env.token);
