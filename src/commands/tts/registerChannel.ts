import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { setTtsChannel } from '@/libs/redis';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('채널등록')
        .setDescription('이 텍스트 채널을 TTS 자동 읽기 채널로 지정해요.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply();

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        try {
            await setTtsChannel(interaction.guildId, interaction.channelId);
            await safeReply(interaction, [
                buildSuccessEmbed('TTS 채널로 등록했어요', `이제 <#${interaction.channelId}> 채널에 올라오는 메시지를 음성 채널에서 읽어드려요.`),
            ]);
        } catch (error) {
            await handleCommandError(interaction, error, '/채널등록');
        }
    },
};

export default command;
