import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { setVolume } from '@/services/audio/playerOrchestrator';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('볼륨')
        .setDescription('재생 볼륨을 설정해요 (0~100).')
        .addIntegerOption((option) => option.setName('값').setDescription('0~100 사이의 볼륨 값').setRequired(true).setMinValue(0).setMaxValue(100)),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        const value = interaction.options.getInteger('값', true);

        try {
            const applied = setVolume(interaction.guildId, value);
            if (!applied) {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않거나 재생 중인 곡이 없어요.'),
                ]);
                return;
            }
            await safeReply(interaction, [buildSuccessEmbed('🔊 볼륨을 조절했어요', `현재 볼륨: ${value}%`)]);
        } catch (error) {
            await handleCommandError(interaction, error, '/볼륨');
        }
    },
};

export default command;
