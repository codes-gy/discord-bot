import type { MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { getReactionRole } from '@/libs/redis';
import { logger } from '@/utils/logger';

/**
 * MessageReactionAdd/Remove 공통 처리 (기획서 F-15).
 * partial(캐시되지 않은) 리액션/유저는 각각 fetch로 완전한 데이터를 받아온 뒤 처리한다.
 */
async function resolveReactionContext(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<{ reaction: MessageReaction; roleId: string } | null> {
    if (user.bot) {
        return null;
    }

    try {
        const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
        if (user.partial) {
            await user.fetch();
        }

        const emojiKey = fullReaction.emoji.id ?? fullReaction.emoji.name;
        if (!emojiKey || !fullReaction.message.guild) {
            return null;
        }

        const roleId = await getReactionRole(fullReaction.message.id, emojiKey);
        if (!roleId) {
            return null;
        }

        return { reaction: fullReaction, roleId };
    } catch (error) {
        logger.error('[reactionRole] 리액션/유저 정보 조회 실패:', error);
        return null;
    }
}

export async function handleMessageReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> {
    const context = await resolveReactionContext(reaction, user);
    if (!context) {
        return;
    }

    const guild = context.reaction.message.guild;
    if (!guild) {
        return;
    }

    try {
        const member = await guild.members.fetch(user.id);
        await member.roles.add(context.roleId);
    } catch (error) {
        logger.error(`[reactionRole] 역할 부여 실패 (guildId=${guild.id}, roleId=${context.roleId}):`, error);
    }
}

export async function handleMessageReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> {
    const context = await resolveReactionContext(reaction, user);
    if (!context) {
        return;
    }

    const guild = context.reaction.message.guild;
    if (!guild) {
        return;
    }

    try {
        const member = await guild.members.fetch(user.id);
        await member.roles.remove(context.roleId);
    } catch (error) {
        logger.error(`[reactionRole] 역할 제거 실패 (guildId=${guild.id}, roleId=${context.roleId}):`, error);
    }
}
