import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { stopAndClearQueue } from '@/services/audio/playerOrchestrator';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder().setName('정지').setDescription('음악 재생을 중단하고 대기열을 모두 비워요.'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const stopped = stopAndClearQueue(interaction.guildId);
            if (!stopped) {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않거나 재생 중인 곡이 없어요.'),
                ]);
                return;
            }
            await safeReply(interaction, [
                buildSuccessEmbed('재생을 정지했어요', '대기열을 모두 비웠어요. 3분 동안 새 곡이 없으면 자동으로 퇴장할게요.'),
            ]);
        } catch (error) {
            await handleCommandError(interaction, error, '/정지');
        }
    },
};

export default command;
