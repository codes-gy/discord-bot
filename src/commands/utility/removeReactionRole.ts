import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { removeReactionRole } from '@/libs/redis';
import { parseEmojiKey } from '@/utils/emoji';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('리액션역할해제')
        .setDescription('등록된 리액션 역할 바인딩을 해제해요.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption((option) => option.setName('메시지id').setDescription('대상 메시지의 ID').setRequired(true))
        .addStringOption((option) => option.setName('이모지').setDescription('해제할 이모지').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        const messageId = interaction.options.getString('메시지id', true).trim();
        const emojiInput = interaction.options.getString('이모지', true);

        try {
            const emojiKey = parseEmojiKey(emojiInput);
            await removeReactionRole(messageId, emojiKey);
            await safeReply(interaction, [buildSuccessEmbed('리액션 역할 등록을 해제했어요', '이제 해당 메시지의 이 이모지 반응은 역할에 영향을 주지 않아요.')]);
        } catch (error) {
            await handleCommandError(interaction, error, '/리액션역할해제');
        }
    },
};

export default command;
