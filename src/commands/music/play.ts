import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import play from 'play-dl';
import type { Command } from '@/types';
import { resolveTrack, searchTopResults } from '@/services/audio/youtubeService';
import { joinAndEnqueue } from '@/services/audio/playerOrchestrator';
import { buildNowPlayingEmbed, buildQueueAddedEmbed, buildEmptyStateEmbed, buildErrorEmbed, buildNowPlayingComponents } from '@/utils/embeds';
import { buildTrackSelectMenu } from '@/utils/trackSelect';
import { handleCommandError, safeReply } from '@/utils/errorHandler';
import { resolveVoiceContext } from '@/utils/voiceGuard';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('재생')
        .setDescription('유튜브 URL 또는 검색어로 음악을 재생하거나 대기열에 추가해요.')
        .addStringOption((option) => option.setName('검색어').setDescription('유튜브 URL 또는 검색할 키워드').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
        // 디스코드 API 3초 제약(Interaction Timeout) 방지를 위해 최우선으로 defer. 모든 응답은 비공개(ephemeral)로 표시한다.
        await interaction.deferReply({ ephemeral: true });

        const voiceContext = resolveVoiceContext(interaction);
        if (!voiceContext.ok) {
            await safeReply(interaction, [buildEmptyStateEmbed(voiceContext.title, voiceContext.description)]);
            return;
        }
        const { voiceChannel } = voiceContext;

        const query = interaction.options.getString('검색어', true).trim();

        try {
            // URL이면 바로 재생, 순수 검색어면 상위 5개 결과를 선택 메뉴로 보여준다 (기획서 F-12).
            const validation = play.yt_validate(query);
            if (validation !== 'video' && validation !== 'playlist') {
                const results = await searchTopResults(query, 5);
                if (results.length === 0) {
                    await safeReply(interaction, [buildErrorEmbed('검색 결과가 없어요', `"${query}"에 대한 검색 결과를 찾지 못했어요.`)]);
                    return;
                }
                await interaction.editReply({
                    embeds: [buildEmptyStateEmbed('검색 결과를 선택해주세요', '아래 목록에서 재생할 곡을 골라주세요. (1분 내 미선택 시 만료돼요)')],
                    components: [buildTrackSelectMenu(results)],
                });
                return;
            }

            const resolved = await resolveTrack(query);
            const item = {
                ...resolved.item,
                requestedById: interaction.user.id,
                requestedByTag: interaction.user.tag,
            };

            const result = await joinAndEnqueue(voiceChannel, interaction.channelId, item);

            if (result.startedImmediately) {
                if (result.startedItem) {
                    await safeReply(
                        interaction,
                        [buildNowPlayingEmbed(result.startedItem, result.remainingInQueue ?? 0)],
                        true,
                        [buildNowPlayingComponents()]
                    );
                } else {
                    await safeReply(interaction, [
                        buildErrorEmbed('재생을 시작하지 못했어요', '요청한 곡을 재생하지 못해서 대기열이 비었어요. 다른 곡으로 다시 시도해주세요.'),
                    ]);
                }
            } else {
                await safeReply(interaction, [buildQueueAddedEmbed(item, result.position)]);
            }
        } catch (error) {
            await handleCommandError(interaction, error, '/재생');
        }
    },
};

export default command;
