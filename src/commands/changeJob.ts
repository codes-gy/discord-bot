import { changeJobInContent, createThreadUrl, findMemberListMessage, findThreadByExactName, saveMemberListMessage } from '../services/forumService';
import type { CommandHandlerWithClient, JobType } from '../types/forumType';
import { logger } from '../utils/logger';
import { getSubjectParticle } from '../utils/korean';

export const handleChangeJob: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    const guildName = interaction.options.getString('문파명', true).toLowerCase();
    const nickname = interaction.options.getString('캐릭터명', true).trim();
    const newJobTarget = interaction.options.getString('직업명', true) as JobType;
    const cleanJobName = newJobTarget.replace(/^[#\s]+/, '').trim();
    const particle = getSubjectParticle(guildName);
    try {
        logger.info('직업변경 명령어 실행', {
            user: interaction.user.tag,
            guildName,
            nickname,
            jobName: cleanJobName,
        });

        const targetThread = await findThreadByExactName(forumChannel, guildName);

        if (!targetThread) {
            logger.warn('직업변경 실패(제목 없음)', {
                guildName,
                nickname,
            });
            await interaction.editReply(`제목에 "${guildName}"${particle} 포함된 포스트를 찾지 못했습니다.`);
            return;
        }

        const targetMessage = await findMemberListMessage({
            thread: targetThread,
        });

        if (!targetMessage) {
            logger.warn('직업변경 실패(양식 없음)', {
                threadName: targetThread.name,
                nickname,
            });
            await interaction.editReply('해당 포스트 내부에서 명단 양식을 찾지 못했습니다.');
            return;
        }

        const result = changeJobInContent({
            content: targetMessage.content,
            nickname,
            newJobTarget,
        });

        if (!result.success) {
            logger.warn('직업변경 실패(변경 불가)', {
                threadName: targetThread.name,
                nickname,
                jobName: cleanJobName,
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

        logger.info('직업변경 완료', {
            threadName: targetThread.name,
            nickname,
            jobName: cleanJobName,
        });

        await interaction.editReply(
            `[${targetThread.name}](${createThreadUrl(
                interaction.guildId,
                targetThread.id
            )})에서 "${nickname}" 님의 직업을 **${cleanJobName}**로 변경했습니다.`
        );
    } catch (error) {
        logger.error('직업변경 중 오류 발생', error, {
            user: interaction.user.tag,
            guildName,
            nickname,
            cleanJobName,
        });
        await interaction.editReply('직업 변경 중 오류가 발생했습니다.').catch(() => {});
    }
};
