import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { leaveGuild } from '@/services/audio/playerOrchestrator';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder().setName('퇴장').setDescription('음성 채널에서 나가고 대기열 상태를 모두 초기화해요.'),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const left = await leaveGuild(interaction.guildId);
            if (!left) {
                await safeReply(interaction, [buildEmptyStateEmbed('봇이 음성 채널에 없어요', '이미 음성 채널에 접속해 있지 않아요.')]);
                return;
            }
            await safeReply(interaction, [buildSuccessEmbed('음성 채널에서 나갔어요', '대기열과 재생 상태를 모두 초기화했어요.')]);
        } catch (error) {
            await handleCommandError(interaction, error, '/퇴장');
        }
    },
};

export default command;
