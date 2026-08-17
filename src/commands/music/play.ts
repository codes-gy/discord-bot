import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import type { Command, QueueItem } from '@/types';
import { resolveTrack } from '@/services/audio/youtubeService';
import { joinAndEnqueue } from '@/services/audio/playerOrchestrator';
import { buildNowPlayingEmbed, buildQueueAddedEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { handleCommandError, safeReply } from '@/utils/errorHandler';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('재생')
        .setDescription('유튜브 URL 또는 검색어로 음악을 재생하거나 대기열에 추가해요.')
        .addStringOption((option) => option.setName('검색어').setDescription('유튜브 URL 또는 검색할 키워드').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        // 디스코드 API 3초 제약(Interaction Timeout) 방지를 위해 최우선으로 defer
        await interaction.deferReply();

        if (!interaction.guild) {
            await safeReply(interaction, [buildEmptyStateEmbed('서버 전용 명령어예요', '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.')]);
            return;
        }

        const member = interaction.member as GuildMember | null;
        const voiceChannel = member?.voice.channel ?? null;
        if (!voiceChannel) {
            await safeReply(interaction, [
                buildEmptyStateEmbed('음성 채널에 먼저 입장해주세요', '`/재생`은 음성 채널에 입장한 상태에서만 사용할 수 있어요.'),
            ]);
            return;
        }

        const botMember = interaction.guild.members.me;
        if (botMember) {
            const permissions = voiceChannel.permissionsFor(botMember);
            if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
                await safeReply(interaction, [
                    buildEmptyStateEmbed('권한이 부족해요', '봇에게 해당 음성 채널의 `연결` 및 `말하기` 권한이 필요해요.'),
                ]);
                return;
            }
        }

        const query = interaction.options.getString('검색어', true);

        try {
            const resolved = await resolveTrack(query);
            const item: QueueItem = {
                ...resolved.item,
                requestedById: interaction.user.id,
                requestedByTag: interaction.user.tag,
            };

            const result = await joinAndEnqueue(voiceChannel, interaction.channelId, item);

            if (result.startedImmediately) {
                await safeReply(interaction, [buildNowPlayingEmbed(item, 0)]);
            } else {
                await safeReply(interaction, [buildQueueAddedEmbed(item, result.position)]);
            }
        } catch (error) {
            await handleCommandError(interaction, error, '/재생');
        }
    },
};

export default command;
