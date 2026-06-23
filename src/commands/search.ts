import { Collection, Message, ThreadChannel } from 'discord.js';
import { createThreadUrl, getAllThreads } from '../services/forumService';
import { CommandHandler } from '../types/forumType';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

export const handleSearch: CommandHandler = async ({ interaction, forumChannel }) => {
    const rawKeyword = interaction.options.getString('검색어', true);
    const keyword = rawKeyword.toLowerCase();
    try {
        logger.info('검색 명령어 실행', {
            user: interaction.user.tag,
            keyword: rawKeyword,
        });

        const allThreads = await getAllThreads(forumChannel);

        const matchedThreads: ThreadChannel[] = allThreads.filter((thread) => thread.name.toLowerCase().includes(keyword));

        const remainingThreads = allThreads.filter((thread) => !matchedThreads.includes(thread));

        const searchPromises = remainingThreads.map(async (thread) => {
            try {
                const starterMessage = await thread.fetchStarterMessage().catch(() => null);
                if (starterMessage?.content.toLowerCase().includes(keyword)) {
                    return thread;
                }

                const messages = await thread.messages.fetch({ limit: 50 }).catch(() => new Collection<string, Message>());
                if (messages.some((msg) => msg.content.toLowerCase().includes(keyword))) {
                    return thread;
                }
            } catch (error) {
                logger.error('스레드 검색 중 오류 발생', {
                    threadId: thread.id,
                    threadName: thread.name,
                    error,
                });
            }
            return null;
        });

        const parallelResults = await Promise.all(searchPromises);

        for (const thread of parallelResults) {
            if (thread) matchedThreads.push(thread);
        }

        if (matchedThreads.length === 0) {
            logger.info('검색 완료(결과 없음)', {
                user: interaction.user.tag,
                keyword: rawKeyword,
                searchedThreadCount: allThreads.length,
            });
            await interaction.editReply(`"${rawKeyword}" 문구가 포함된 포스트를 찾지 못했습니다.\n\`/등록\` 명령어를 통해 새로 추가해주세요.`);
            return;
        }

        let replyMessage = `**검색 결과 (총 ${matchedThreads.length}개):**\n`;
        let visibleCount = 0;

        for (const thread of matchedThreads) {
            const threadLink = createThreadUrl(interaction.guildId, thread.id);
            const line = `• **${rawKeyword}**는 [${thread.name}](${threadLink})입니다.\n`;

            if ((replyMessage + line).length > env.MAX_DISCORD_MESSAGE_LENGTH) {
                break;
            }

            replyMessage += line;
            visibleCount++;
        }

        const hiddenCount = matchedThreads.length - visibleCount;

        if (hiddenCount > 0) {
            replyMessage += `\n외 ${hiddenCount}개의 검색 결과가 더 있습니다.`;
        }

        logger.info('검색 완료(결과 확인)', {
            user: interaction.user.tag,
            keyword: rawKeyword,
            searchedThreadCount: allThreads.length,
            resultCount: matchedThreads.length,
        });

        await interaction.editReply(replyMessage);
    } catch (error) {
        logger.error('검색 중 오류 발생', error, {
            user: interaction.user.tag,
            keyword: rawKeyword,
        });

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('검색 처리 중 오류가 발생했습니다.').catch(() => {});
        } else {
            await interaction.reply({ content: '검색 중 오류가 발생했습니다.' }).catch(() => {});
        }
    }
};
