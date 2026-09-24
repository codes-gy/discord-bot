import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { resumeMusic } from '@/services/audio/playerOrchestrator';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder().setName('재개').setDescription('일시정지된 음악을 다시 이어서 재생해요.'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const result = resumeMusic(interaction.guildId);
            if (result === 'nothing-playing') {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않거나 재생 중인 곡이 없어요.'),
                ]);
                return;
            }
            if (result === 'not-paused') {
                await safeReply(interaction, [buildEmptyStateEmbed('일시정지 상태가 아니에요', '이미 정상적으로 재생 중이에요.')]);
                return;
            }
            await safeReply(interaction, [buildSuccessEmbed('▶ 다시 재생할게요', '일시정지된 곡을 이어서 재생해요.')]);
        } catch (error) {
            await handleCommandError(interaction, error, '/재개');
        }
    },
};

export default command;
