import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { setUserTtsLang } from '@/libs/redis';
import { TTS_LANGUAGE_CHOICES } from '@/services/audio/ttsService';
import { buildSuccessEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const LANG_LABEL = Object.fromEntries(TTS_LANGUAGE_CHOICES.map((choice) => [choice.value, choice.name]));

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('tts설정')
        .setDescription('내 메시지를 읽어줄 때 사용할 TTS 언어를 설정해요.')
        .addStringOption((option) =>
            option
                .setName('언어')
                .setDescription('TTS로 읽어줄 언어를 선택하세요.')
                .setRequired(true)
                .addChoices(...TTS_LANGUAGE_CHOICES)
        ),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        const lang = interaction.options.getString('언어', true);

        try {
            await setUserTtsLang(interaction.user.id, lang);
            await safeReply(interaction, [
                buildSuccessEmbed('🗣 TTS 언어를 설정했어요', `이제부터 회원님의 메시지는 **${LANG_LABEL[lang] ?? lang}**(으)로 읽어드려요.`),
            ]);
        } catch (error) {
            await handleCommandError(interaction, error, '/tts설정');
        }
    },
};

export default command;
