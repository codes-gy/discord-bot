import { EmbedBuilder } from 'discord.js';
import type { QueueItem } from '@/types';
import { formatDuration } from '@/utils/time';

const COLOR_SUCCESS = 0x57f287;
const COLOR_ERROR = 0xed4245;
const COLOR_EMPTY = 0xfee75c;
const COLOR_LOADING = 0x5865f2;
const COLOR_INFO = 0x5865f2;

export function buildLoadingEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder().setColor(COLOR_LOADING).setTitle(`⏳ ${title}`).setDescription(description);
}

export function buildSuccessEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder().setColor(COLOR_SUCCESS).setTitle(`✅ ${title}`).setDescription(description);
}

export function buildErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder().setColor(COLOR_ERROR).setTitle(`⚠️ ${title}`).setDescription(description);
}

export function buildEmptyStateEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder().setColor(COLOR_EMPTY).setTitle(`📭 ${title}`).setDescription(description);
}

export function buildNowPlayingEmbed(item: QueueItem, remainingInQueue: number): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(COLOR_SUCCESS)
        .setTitle('🎶 재생을 시작했어요')
        .setDescription(`[${item.title}](${item.url})`)
        .addFields(
            { name: '재생 시간', value: formatDuration(item.durationSec), inline: true },
            { name: '요청자', value: `<@${item.requestedById}>`, inline: true },
            { name: '남은 대기열', value: `${remainingInQueue}곡`, inline: true }
        );
    if (item.thumbnailUrl) {
        embed.setThumbnail(item.thumbnailUrl);
    }
    return embed;
}

export function buildQueueAddedEmbed(item: QueueItem, position: number): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(COLOR_SUCCESS)
        .setTitle('➕ 대기열에 추가했어요')
        .setDescription(`[${item.title}](${item.url})`)
        .addFields(
            { name: '재생 시간', value: formatDuration(item.durationSec), inline: true },
            { name: '대기 순번', value: `${position}번째`, inline: true },
            { name: '요청자', value: `<@${item.requestedById}>`, inline: true }
        );
    if (item.thumbnailUrl) {
        embed.setThumbnail(item.thumbnailUrl);
    }
    return embed;
}

export function buildQueueListEmbed(current: QueueItem | null, queue: QueueItem[]): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(COLOR_INFO).setTitle('🎧 재생목록');

    if (current) {
        embed.addFields({
            name: '지금 재생 중',
            value: `[${current.title}](${current.url}) · ${formatDuration(current.durationSec)} · <@${current.requestedById}>`,
        });
    } else {
        embed.addFields({ name: '지금 재생 중', value: '재생 중인 곡이 없어요.' });
    }

    if (queue.length === 0) {
        embed.addFields({ name: '대기열', value: '대기 중인 곡이 없어요.' });
    } else {
        const lines = queue
            .slice(0, 10)
            .map((item, index) => `${index + 1}. [${item.title}](${item.url}) · ${formatDuration(item.durationSec)} · <@${item.requestedById}>`)
            .join('\n');
        const more = queue.length > 10 ? `\n...외 ${queue.length - 10}곡` : '';
        embed.addFields({ name: `대기열 (${queue.length}곡)`, value: lines + more });
    }

    return embed;
}
