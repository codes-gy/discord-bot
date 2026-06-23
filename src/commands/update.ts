import {
    createThreadUrl,
    findMemberListMessage,
    findThreadByExactName,
    saveMemberListMessage,
    updateNicknameInContent,
} from '../services/forumService';
import type { CommandHandlerWithClient } from '../types/forumType';
import { logger } from '../utils/logger';
import { getSubjectParticle } from '../utils/korean';

export const handleUpdate: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    const guildName = interaction.options.getString('문파명', true).toLowerCase();
    const oldNickname = interaction.options.getString('기존캐릭터명', true).trim();
    const newNickname = interaction.options.getString('새캐릭터명', true).trim();
    const particle = getSubjectParticle(guildName);
    try {
        logger.info('수정 명령어 실행', {
            user: interaction.user.tag,
            guildName,
            oldNickname,
            newNickname,
        });

        const targetThread = await findThreadByExactName(forumChannel, guildName);

        if (!targetThread) {
            logger.warn('수정 실패(제목 없음)', {
                guildName,
                oldNickname,
                newNickname,
            });
            await interaction.editReply(`제목에 "${guildName}"${particle} 포함된 문파명을 찾지 못했습니다.`); //이(가)
            return;
        }

        const targetMessage = await findMemberListMessage({
            thread: targetThread,
        });

        if (!targetMessage) {
            logger.warn('수정 실패(양식 없음)', {
                threadName: targetThread.name,
                oldNickname,
                newNickname,
            });
            await interaction.editReply('해당 포스트 내부에서 양식을 찾지 못했습니다.');
            return;
        }

        const result = updateNicknameInContent({
            content: targetMessage.content,
            oldNickname,
            newNickname,
        });

        if (!result.success) {
            logger.warn('수정 실패(캐릭터 명 변경 불가)', {
                threadName: targetThread.name,
                oldNickname,
                newNickname,
                reason: result.message,
            });
            await interaction.editReply(result.message);
            return;
        }

        await saveMemberListMessage({
            client,
            thread: targetThread,
            targetMessage,
            updatedContent: result.message,
        });

        logger.info('수정 완료', {
            threadName: targetThread.name,
            oldNickname,
            newNickname,
        });

        await interaction.editReply(
            `[${targetThread.name}](${createThreadUrl(
                interaction.guildId,
                targetThread.id
            )}) 에서 "${oldNickname}" → "${newNickname}" 으로 수정했습니다.`
        );
    } catch (error) {
        logger.error('수정 중 오류 발생', error, {
            user: interaction.user.tag,
            guildName,
            oldNickname,
            newNickname,
        });
        await interaction.editReply('수정 처리 중 오류가 발생했습니다.').catch(() => {});
    }
};
