import { createThreadUrl, findDuplicateMembersInContents, findMemberListMessage, getAllThreads } from '../services/forumService';
import type { CommandHandler } from '../types/forumType';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

export const handleCheckDuplicate: CommandHandler = async ({ interaction, forumChannel }) => {
    try {
        logger.info('중복검사 명령어 실행', {
            user: interaction.user.tag,
        });

        const threads = await getAllThreads(forumChannel);

        const rawContents = await Promise.all(
            threads.map(async (thread) => {
                const message = await findMemberListMessage({ thread }).catch(() => undefined);

                if (!message) return null;
                return {
                    threadName: thread.name,
                    threadUrl: createThreadUrl(interaction.guildId, thread.id),
                    content: message.content.replace(/_/g, ''),
                };
            })
        );
        const contents = rawContents.filter((item): item is NonNullable<typeof item> => item !== null);
        const duplicates = findDuplicateMembersInContents(contents);

        if (duplicates.length === 0) {
            logger.info('중복검사 완료(중복 없음)', {
                user: interaction.user.tag,
                threadCount: threads.length,
                checkedPostCount: contents.length,
            });
            await interaction.editReply('전체 포스트에서 중복 등록된 캐릭터명을 찾지 못했습니다.');
            return;
        }

        let replyMessage = '**중복 캐릭터 검사 결과**\n\n';
        let visibleCount = 0;

        for (const duplicate of duplicates) {
            const locations = duplicate.locations
                .map((location) => location.threadName)
                .filter((name, index, array) => array.indexOf(name) === index)
                .join(', ');

            const block = `${visibleCount + 1}. ${duplicate.nickname} - ${locations}\n`;

            if ((replyMessage + block).length > env.MAX_DISCORD_MESSAGE_LENGTH) {
                break;
            }

            replyMessage += block;
            visibleCount++;
        }

        const hiddenCount = duplicates.length - visibleCount;

        if (hiddenCount > 0) {
            replyMessage += `\n외 ${hiddenCount}개의 중복된 항목이 있습니다.`;
        }

        logger.info('중복검사 완료', {
            user: interaction.user.tag,
            threadCount: threads.length,
            checkedPostCount: contents.length,
            duplicateCount: duplicates.length,
            visibleCount: visibleCount,
            hiddenCount: hiddenCount,
        });

        await interaction.editReply(replyMessage);
    } catch (error) {
        logger.error('중복검사 중 오류 발생', error, {
            user: interaction.user.tag,
        });
        await interaction.editReply('중복 검사 중 오류가 발생했습니다.').catch(() => {});
    }
};
