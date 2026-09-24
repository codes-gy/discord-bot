import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getWelcomeChannel, removeWelcomeChannel } from '@/libs/redis';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('환영채널해제')
        .setDescription('등록된 환영 메시지 채널 설정을 해제해요.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const registeredChannelId = await getWelcomeChannel(interaction.guildId);
            if (!registeredChannelId) {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('등록된 환영 채널이 없어요', '`/환영채널등록`으로 먼저 채널을 지정해주세요.'),
                ]);
                return;
            }

            await removeWelcomeChannel(interaction.guildId);
            await safeReply(interaction, [buildSuccessEmbed('환영 채널 등록을 해제했어요', '이제 신규 멤버가 입장해도 환영 메시지를 보내지 않아요.')]);
        } catch (error) {
            await handleCommandError(interaction, error, '/환영채널해제');
        }
    },
};

export default command;
