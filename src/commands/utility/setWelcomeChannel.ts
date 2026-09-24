import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { setWelcomeChannel } from '@/libs/redis';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('환영채널등록')
        .setDescription('신규 멤버가 입장했을 때 환영 메시지를 보낼 채널을 지정해요.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption((option) =>
            option
                .setName('채널')
                .setDescription('환영 메시지를 보낼 채널 (생략 시 현재 채널)')
                .addChannelTypes(ChannelType.GuildText)
        ),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        const targetChannel = interaction.options.getChannel('채널') ?? interaction.channel;
        if (!targetChannel) {
            await safeReply(interaction, [buildEmptyStateEmbed('채널을 찾을 수 없어요', '다시 시도해주세요.')]);
            return;
        }

        try {
            await setWelcomeChannel(interaction.guildId, targetChannel.id);
            await safeReply(interaction, [
                buildSuccessEmbed('환영 채널로 등록했어요', `이제 신규 멤버가 입장하면 <#${targetChannel.id}> 채널에 환영 메시지를 보내드려요.`),
            ]);
        } catch (error) {
            await handleCommandError(interaction, error, '/환영채널등록');
        }
    },
};

export default command;
