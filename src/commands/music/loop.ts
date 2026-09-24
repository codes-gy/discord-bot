import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { setLoopMode } from '@/services/audio/playerOrchestrator';
import { buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const LOOP_MODE_LABEL: Record<string, string> = {
    off: '반복을 껐어요',
    track: '한 곡 반복으로 설정했어요',
    queue: '전체 반복으로 설정했어요',
};

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('반복')
        .setDescription('반복 재생 모드를 설정해요.')
        .addStringOption((option) =>
            option
                .setName('모드')
                .setDescription('반복 모드를 선택하세요.')
                .setRequired(true)
                .addChoices({ name: '끄기', value: 'off' }, { name: '한 곡 반복', value: 'track' }, { name: '전체 반복', value: 'queue' })
        ),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        const mode = interaction.options.getString('모드', true) as 'off' | 'track' | 'queue';

        try {
            const applied = setLoopMode(interaction.guildId, mode);
            if (!applied) {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않거나 재생 중인 곡이 없어요.'),
                ]);
                return;
            }
            await safeReply(interaction, [buildSuccessEmbed('🔁 ' + LOOP_MODE_LABEL[mode], '')]);
        } catch (error) {
            await handleCommandError(interaction, error, '/반복');
        }
    },
};

export default command;
