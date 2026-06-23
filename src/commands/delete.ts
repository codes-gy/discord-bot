import { createThreadUrl, findMemberListMessage, findThreadByName, removeNicknameFromContent, saveMemberListMessage } from '../services/forumService';
import { CommandHandlerWithClient } from '../types/forumType';
import { logger } from '../utils/logger';

export const handleDelete: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    const guildName = interaction.options.getString('문파명', true).toLowerCase();
    const nickname = interaction.options.getString('캐릭터명', true).trim();
    try {
        logger.info('삭제 명령어 실행', {
            user: interaction.user.tag,
            guildName,
            nickname,
        });

        const targetThread = await findThreadByName(forumChannel, guildName);
        if (!targetThread) {
            logger.warn('삭제 실패(제목 없음)', {
                guildName,
                nickname,
            });
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 문파 포스트를 찾지 못했습니다.`);
            return;
        }

        const targetMessage = await findMemberListMessage({ thread: targetThread });
        if (!targetMessage) {
            logger.warn('삭제 실패(양식 없음)', {
                threadName: targetThread.name,
                nickname,
            });
            await interaction.editReply('해당 포스트 내부에서 명단 양식을 찾지 못했습니다.');
            return;
        }

        const result = removeNicknameFromContent({ content: targetMessage.content, nickname });

        if (!result.success) {
            logger.warn('삭제 실패(삭제 불가)', {
                threadName: targetThread.name,
                nickname,
                reason: result.message,
            });
            await interaction.editReply(result.message);
            return;
        }

        await saveMemberListMessage({
            client,
            thread: targetThread,
            targetMessage,
            updatedContent: result.message, // 서비스 결과의 message에 수정된 전체 텍스트가 담겨있음
        });

        logger.info('삭제 완료', {
            threadName: targetThread.name,
            nickname,
        });

        await interaction.editReply(
            `[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)}) 명단에서 "${nickname}" 님을 성공적으로 삭제했습니다.`
        );
    } catch (error) {
        logger.error('삭제 중 오류 발생', error, {
            user: interaction.user.tag,
            guildName,
            nickname,
        });

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('삭제 처리 중 오류가 발생했습니다. 다시 시도해주세요.').catch(() => {});
        } else {
            await interaction.reply({ content: '삭제 처리 중 오류가 발생했습니다.' }).catch(() => {});
        }
    }
};
