import type { StringSelectMenuInteraction } from 'discord.js';
import { resolveTrack } from '@/services/audio/youtubeService';
import { joinAndEnqueue } from '@/services/audio/playerOrchestrator';
import { buildNowPlayingEmbed, buildQueueAddedEmbed, buildEmptyStateEmbed, buildErrorEmbed, buildNowPlayingComponents } from '@/utils/embeds';
import { resolveVoiceContext } from '@/utils/voiceGuard';
import { logger } from '@/utils/logger';

/**
 * 검색결과 선택 UI(기획서 F-12)에서 사용자가 곡을 고른 뒤의 처리.
 * play.ts와 동일한 resolveVoiceContext로 재검증한다 — 선택 메뉴를 띄운 뒤 사용자가
 * 음성 채널을 나갔을 수도 있기 때문에, 메뉴 표시 시점의 검증 결과를 재사용하지 않는다.
 */
export async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();

    const voiceContext = resolveVoiceContext(interaction);
    if (!voiceContext.ok) {
        await interaction.editReply({ embeds: [buildEmptyStateEmbed(voiceContext.title, voiceContext.description)], components: [] });
        return;
    }
    const { voiceChannel } = voiceContext;

    const selectedUrl = interaction.values[0];

    try {
        const resolved = await resolveTrack(selectedUrl);
        const item = {
            ...resolved.item,
            requestedById: interaction.user.id,
            requestedByTag: interaction.user.tag,
        };

        const result = await joinAndEnqueue(voiceChannel, interaction.channelId, item);

        if (result.startedImmediately) {
            if (result.startedItem) {
                await interaction.editReply({
                    embeds: [buildNowPlayingEmbed(result.startedItem, result.remainingInQueue ?? 0)],
                    components: [buildNowPlayingComponents()],
                });
            } else {
                await interaction.editReply({
                    embeds: [buildErrorEmbed('재생을 시작하지 못했어요', '선택한 곡을 재생하지 못했어요. 다시 시도해주세요.')],
                    components: [],
                });
            }
        } else {
            await interaction.editReply({ embeds: [buildQueueAddedEmbed(item, result.position)], components: [] });
        }
    } catch (error) {
        logger.error('[select:music] 선택한 곡 재생 중 오류가 발생했습니다:', error);
        const description = error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.';
        await interaction.editReply({ embeds: [buildErrorEmbed('곡을 재생하지 못했어요', description)], components: [] });
    }
}
