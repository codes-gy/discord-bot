import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getServerQueue } from '@/services/audio/queueStore';
import { buildQueueListEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder().setName('재생목록').setDescription('현재 재생 중인 곡과 대기열을 보여줘요.'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply();

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const serverQueue = getServerQueue(interaction.guildId);
            if (!serverQueue || (!serverQueue.currentItem && serverQueue.queue.length === 0)) {
                await safeReply(interaction, [buildEmptyStateEmbed('대기열이 비어 있어요', '`/재생`으로 첫 곡을 추가해보세요!')]);
                return;
            }
            await safeReply(interaction, [buildQueueListEmbed(serverQueue.currentItem, serverQueue.queue)]);
        } catch (error) {
            await handleCommandError(interaction, error, '/재생목록');
        }
    },
};

export default command;
