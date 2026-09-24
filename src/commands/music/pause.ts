import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { pauseMusic } from '@/services/audio/playerOrchestrator';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder().setName('일시정지').setDescription('현재 재생 중인 곡을 대기열은 그대로 둔 채 일시정지해요.'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const result = pauseMusic(interaction.guildId);
            if (result === 'nothing-playing') {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않거나 재생 중인 곡이 없어요.'),
                ]);
                return;
            }
            if (result === 'already-paused') {
                await safeReply(interaction, [buildEmptyStateEmbed('이미 일시정지 상태예요', '`/재개`로 다시 이어서 재생할 수 있어요.')]);
                return;
            }
            await safeReply(interaction, [buildSuccessEmbed('⏸ 일시정지했어요', '`/재개`로 이어서 재생할 수 있어요.')]);
        } catch (error) {
            await handleCommandError(interaction, error, '/일시정지');
        }
    },
};

export default command;
