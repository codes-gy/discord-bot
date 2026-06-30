import { Collection, Message, ThreadChannel } from 'discord.js';
import { createThreadUrl, findMemberListMessage, getAllThreads } from '../services/forumService';
import type { CommandHandler } from '../types/forumType';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { getTopicParticle } from '../utils/korean';

interface SearchResult {
    thread: ThreadChannel;
    matchedWord: string;
}

export const handleSearch: CommandHandler = async ({ interaction, forumChannel }) => {
    const rawKeyword = interaction.options.getString('검색어', true).trim();

    if (rawKeyword.length < 2 || rawKeyword.length > 6) {
        logger.warn('검색 글자 수 제한 위반', {
            user: interaction.user.tag,
            keyword: rawKeyword,
            length: rawKeyword.length,
        });

        await interaction.editReply('검색어는 최소 **2글자**부터 최대 **6글자**까지 입력할 수 있습니다.');
        return;
    }

    try {
        logger.info('검색 명령어 실행', {
            user: interaction.user.tag,
            keyword: rawKeyword,
        });

        const allThreads = await getAllThreads(forumChannel);

        const searchPromises = allThreads.map(async (thread): Promise<SearchResult | null> => {
            try {
                const starterMessage = await findMemberListMessage({ thread }).catch(() => null);

                if (starterMessage) {
                    const matchedWord = findMatchedWord(starterMessage.content, rawKeyword);

                    if (matchedWord) {
                        return {
                            thread,
                            matchedWord,
                        };
                    }
                }

                const messages = await thread.messages.fetch({ limit: 5 }).catch(() => new Collection<string, Message>());

                for (const message of messages.values()) {
                    const matchedWord = findMatchedWord(message.content, rawKeyword);

                    if (matchedWord) {
                        return {
                            thread,
                            matchedWord,
                        };
                    }
                }
            } catch (error) {
                logger.error('스레드 검색 중 오류 발생', error, {
                    threadId: thread.id,
                    threadName: thread.name,
                });
            }

            return null;
        });

        const parallelResults = await Promise.all(searchPromises);

        const matchedResults: SearchResult[] = parallelResults.filter((result): result is NonNullable<typeof result> => result !== null);

        if (matchedResults.length === 0) {
            logger.info('검색 완료(결과 없음)', {
                user: interaction.user.tag,
                keyword: rawKeyword,
                searchedThreadCount: allThreads.length,
            });

            await interaction.editReply(`"${rawKeyword}" 캐릭터와 정확히 일치하는 포스트를 찾지 못했습니다.`);
            return;
        }

        let replyMessage = `**검색 결과 (총 ${matchedResults.length}개):**\n`;
        let visibleCount = 0;

        for (const result of matchedResults) {
            const threadLink = createThreadUrl(interaction.guildId, result.thread.id);

            const particle = getTopicParticle(result.matchedWord);

            const line = `• **${result.matchedWord}**${particle} [${result.thread.name}](${threadLink}) 입니다.\n`;

            if ((replyMessage + line).length > env.MAX_DISCORD_MESSAGE_LENGTH) {
                break;
            }

            replyMessage += line;
            visibleCount++;
        }

        const hiddenCount = matchedResults.length - visibleCount;

        if (hiddenCount > 0) {
            replyMessage += `\n외 ${hiddenCount}개의 검색 결과가 더 있습니다.`;
        }

        logger.info('검색 완료(결과 확인)', {
            user: interaction.user.tag,
            keyword: rawKeyword,
            searchedThreadCount: allThreads.length,
            resultCount: matchedResults.length,
            visibleCount,
            hiddenCount,
        });

        await interaction.editReply(replyMessage);
    } catch (error) {
        logger.error('검색 중 오류 발생', error, {
            user: interaction.user.tag,
            keyword: rawKeyword,
        });

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('검색 처리 중 오류가 발생했습니다.').catch(() => {});
            return;
        }

        await interaction.reply({ content: '검색 중 오류가 발생했습니다.' }).catch(() => {});
    }
};

function findMatchedWord(content: string, keyword: string): string | null {
    const keywordLower = keyword.toLowerCase();

    return (
        content
            .split(/\s+/)
            .map((word) => word.trim())
            .filter(Boolean)
            .find((word) => word.toLowerCase().includes(keywordLower)) ?? null
    );
}
