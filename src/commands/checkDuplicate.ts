import { createThreadUrl, findDuplicateMembersInContents, findMemberListMessage, getAllThreads } from '../services/forumService';
import type { CommandHandler } from '../types/forumType';

const MAX_DISCORD_MESSAGE_LENGTH = 1900;

export const handleCheckDuplicate: CommandHandler = async ({ interaction, forumChannel }) => {
    try {
        const threads = await getAllThreads(forumChannel);

        const contents = [];

        for (const thread of threads) {
            const message = await findMemberListMessage({ thread }).catch(() => undefined);

            if (!message) continue;

            contents.push({
                threadName: thread.name,
                threadUrl: createThreadUrl(interaction.guildId, thread.id),
                content: message.content,
            });
        }

        const duplicates = findDuplicateMembersInContents(contents);

        if (duplicates.length === 0) {
            await interaction.editReply('전체 포럼 포스트에서 중복 등록된 캐릭터를 찾지 못했습니다.');
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

            if ((replyMessage + block).length > MAX_DISCORD_MESSAGE_LENGTH) {
                break;
            }

            replyMessage += block;
            visibleCount++;
        }

        const hiddenCount = duplicates.length - visibleCount;

        if (hiddenCount > 0) {
            replyMessage += `\n외 ${hiddenCount}개의 중복 항목이 더 있습니다.`;
        }

        await interaction.editReply(replyMessage);
    } catch (error) {
        console.error('[Error] handleCheckDuplicate 중 예외 발생:', error);
        await interaction.editReply('중복 검사 중 오류가 발생했습니다.').catch(() => {});
    }
};
