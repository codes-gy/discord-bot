import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type GuildMember } from 'discord.js';
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
    return new EmbedBuilder().setColor(COLOR_SUCCESS).setTitle(`${title}`).setDescription(description);
}

export function buildErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder().setColor(COLOR_ERROR).setTitle(`${title}`).setDescription(description);
}

export function buildEmptyStateEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder().setColor(COLOR_EMPTY).setTitle(`${title}`).setDescription(description);
}

export function buildNowPlayingEmbed(item: QueueItem, remainingInQueue: number): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(COLOR_SUCCESS)
        .setTitle('재생을 시작했어요')
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
    const embed = new EmbedBuilder().setColor(COLOR_INFO).setTitle('재생목록');

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

/** Now Playing 임베드에 붙는 컨트롤 버튼 (기획서 F-11). 커맨드 응답/자동 알림 메시지 양쪽에서 재사용된다. */
export const MUSIC_BUTTON_ID = {
    pauseResume: 'music:pauseResume',
    skip: 'music:skip',
    stop: 'music:stop',
    loop: 'music:loop',
} as const;

export function buildNowPlayingComponents(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(MUSIC_BUTTON_ID.pauseResume).setEmoji('⏯').setLabel('일시정지/재개').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(MUSIC_BUTTON_ID.skip).setEmoji('⏭').setLabel('스킵').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(MUSIC_BUTTON_ID.stop).setEmoji('⏹').setLabel('정지').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(MUSIC_BUTTON_ID.loop).setEmoji('🔁').setLabel('반복 전환').setStyle(ButtonStyle.Secondary)
    );
}

/** 신규 멤버 환영 메시지 임베드 (기획서 F-14). */
export function buildWelcomeEmbed(member: GuildMember): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(COLOR_SUCCESS)
        .setTitle('환영합니다! 🎉')
        .setDescription(`${member}님, **${member.guild.name}** 서버에 오신 것을 환영해요!`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields({ name: '현재 멤버 수', value: `${member.guild.memberCount}명`, inline: true });
}

/** /통계 커맨드 응답 임베드 (기획서 F-16). */
export function buildGuildStatsEmbed(stats: { totalPlays: number; todayPlays: number; topTracks: { title: string; count: number }[] }): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(COLOR_INFO)
        .setTitle('📊 서버 음악 재생 통계')
        .addFields(
            { name: '오늘 재생 횟수', value: `${stats.todayPlays}회`, inline: true },
            { name: '누적 재생 횟수', value: `${stats.totalPlays}회`, inline: true }
        );

    if (stats.topTracks.length === 0) {
        embed.addFields({ name: '최다 재생곡 TOP 5', value: '아직 재생 기록이 없어요.' });
    } else {
        const lines = stats.topTracks.map((track, index) => `${index + 1}. ${track.title} · ${track.count}회`).join('\n');
        embed.addFields({ name: '최다 재생곡 TOP 5', value: lines });
    }

    return embed;
}
