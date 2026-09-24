import { SlashCommandBuilder, PermissionFlagsBits, TextChannel, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { setReactionRole } from '@/libs/redis';
import { parseEmojiKey } from '@/utils/emoji';
import { buildSuccessEmbed, buildEmptyStateEmbed, buildErrorEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('리액션역할등록')
        .setDescription('이 채널의 특정 메시지에 이모지로 반응하면 역할을 자동으로 부여/해제하도록 등록해요.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption((option) => option.setName('메시지id').setDescription('대상 메시지의 ID (메시지 우클릭 > ID 복사)').setRequired(true))
        .addStringOption((option) => option.setName('이모지').setDescription('반응할 이모지 (유니코드 또는 서버 커스텀 이모지)').setRequired(true))
        .addRoleOption((option) => option.setName('역할').setDescription('반응 시 부여할 역할').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 텍스트 채널에서만 사용할 수 있어요', '')]);
            return;
        }

        const messageId = interaction.options.getString('메시지id', true).trim();
        const emojiInput = interaction.options.getString('이모지', true);
        const role = interaction.options.getRole('역할', true);

        try {
            const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (!message) {
                await safeReply(interaction, [
                    buildErrorEmbed('메시지를 찾을 수 없어요', '이 명령어와 같은 채널에 있는 메시지의 ID를 입력해주세요.'),
                ]);
                return;
            }

            const emojiKey = parseEmojiKey(emojiInput);
            await setReactionRole(message.id, emojiKey, role.id);

            // 사용자가 누를 수 있도록 봇이 먼저 반응을 남겨준다. 실패해도(잘못된 이모지 등) 등록 자체는 유지한다.
            await message.react(emojiInput).catch(() => null);

            await safeReply(interaction, [
                buildSuccessEmbed('리액션 역할을 등록했어요', `이제 해당 메시지에 ${emojiInput}(으)로 반응하면 <@&${role.id}> 역할이 자동으로 부여/해제돼요.`),
            ]);
        } catch (error) {
            await handleCommandError(interaction, error, '/리액션역할등록');
        }
    },
};

export default command;
