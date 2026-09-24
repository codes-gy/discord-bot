import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { shuffleQueue } from '@/services/audio/playerOrchestrator';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder().setName('셔플').setDescription('현재 대기열의 순서를 무작위로 섞어요.'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const shuffled = shuffleQueue(interaction.guildId);
            if (!shuffled) {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('섞을 곡이 부족해요', '대기열에 2곡 이상 있어야 셔플할 수 있어요.'),
                ]);
                return;
            }
            await safeReply(interaction, [buildSuccessEmbed('🔀 대기열을 섞었어요', '`/재생목록`으로 바뀐 순서를 확인해보세요.')]);
        } catch (error) {
            await handleCommandError(interaction, error, '/셔플');
        }
    },
};

export default command;
