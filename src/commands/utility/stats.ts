import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getGuildStats } from '@/libs/redis';
import { buildGuildStatsEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder().setName('통계').setDescription('이 서버의 음악 재생 통계를 보여줘요.'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const stats = await getGuildStats(interaction.guildId);
            await safeReply(interaction, [buildGuildStatsEmbed(stats)]);
        } catch (error) {
            await handleCommandError(interaction, error, '/통계');
        }
    },
};

export default command;
