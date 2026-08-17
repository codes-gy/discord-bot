import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getTtsChannel, removeTtsChannel } from '@/libs/redis';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('채널해제')
        .setDescription('등록된 TTS 자동 읽기 채널 설정을 해제해요.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply();

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            const registeredChannelId = await getTtsChannel(interaction.guildId);
            if (!registeredChannelId) {
                await safeReply(interaction, [buildEmptyStateEmbed('등록된 TTS 채널이 없어요', '`/채널등록`으로 먼저 TTS 채널을 지정해주세요.')]);
                return;
            }

            await removeTtsChannel(interaction.guildId);
            await safeReply(interaction, [
                buildSuccessEmbed('TTS 채널 등록을 해제했어요', `<#${registeredChannelId}> 채널은 이제 일반 텍스트 채널로 동작해요.`),
            ]);
        } catch (error) {
            await handleCommandError(interaction, error, '/채널해제');
        }
    },
};

export default command;
