import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import type { SearchResultItem } from '@/services/audio/youtubeService';
import { formatDuration } from '@/utils/time';

export const TRACK_SELECT_CUSTOM_ID = 'music:selectTrack';

/**
 * 검색결과 선택 UI (기획서 F-12). 선택지의 value에 영상 URL을 그대로 담아서,
 * 선택 인터랙션 핸들러가 별도 서버 측 캐시 없이 곧바로 resolveTrack(url)을 호출할 수 있게 한다.
 */
export function buildTrackSelectMenu(results: SearchResultItem[]): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(TRACK_SELECT_CUSTOM_ID)
        .setPlaceholder('재생할 곡을 선택하세요')
        .addOptions(
            results.map((result, index) => ({
                label: truncate(result.title, 100),
                description: truncate(`${result.channelName ?? '알 수 없음'} · ${formatDuration(result.durationSec)}`, 100),
                value: result.url,
                emoji: NUMBER_EMOJIS[index],
            }))
        );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

function truncate(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
