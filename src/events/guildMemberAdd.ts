import { TextChannel, type GuildMember } from 'discord.js';
import { getWelcomeChannel } from '@/libs/redis';
import { buildWelcomeEmbed } from '@/utils/embeds';
import { logger } from '@/utils/logger';

/**
 * 신규 멤버 입장 환영 메시지 (기획서 F-14).
 * 등록된 환영 채널이 없으면 아무것도 하지 않는다.
 */
export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
    try {
        const channelId = await getWelcomeChannel(member.guild.id);
        if (!channelId) {
            return;
        }

        const channel = await member.guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
            return;
        }

        await channel.send({ embeds: [buildWelcomeEmbed(member)] });
    } catch (error) {
        logger.error(`[guildMemberAdd] 환영 메시지 전송 실패 (guildId=${member.guild.id}):`, error);
    }
}
