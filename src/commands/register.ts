import { addNicknameToContent, createThreadUrl, findMemberListMessage, findThreadByName, saveMemberListMessage } from '../services/forumService';
import { CommandHandlerWithClient, JobType } from '../types/forumType';
import { logger } from '../utils/logger';

export const handleRegister: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    const guildName = interaction.options.getString('문파명', true).toLowerCase();
    const jobTarget = interaction.options.getString('직업명', true) as JobType;
    const nickname = interaction.options.getString('캐릭터명', true).trim();
    const cleanJobName = jobTarget.replace(/^[#\s]+/, '').trim();
    try {
        logger.info('등록 명령어 실행', {
            user: interaction.user.tag,
            guildName,
            jobName: cleanJobName,
            nickname,
        });

        const targetThread = await findThreadByName(forumChannel, guildName);
        if (!targetThread) {
            logger.warn('등록 실패(제목 없음)', {
                guildName,
                nickname,
            });
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 문파 포스트를 찾지 못했습니다.`);
            return;
        }

        const targetMessage = await findMemberListMessage({ thread: targetThread });
        if (!targetMessage) {
            logger.warn('등록 실패(양식 없음)', {
                threadName: targetThread.name,
                nickname,
            });
            await interaction.editReply('해당 문파 포스트에서 양식을 찾지 못했습니다.');
            return;
        }

        const result = addNicknameToContent({
            content: targetMessage.content,
            jobTarget,
            nickname,
        });

        if (!result.success) {
            logger.warn('등록 실패(추가 실패)', {
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
            updatedContent: result.message,
        });

        logger.info('등록 완료', {
            threadName: targetThread.name,
            jobName: cleanJobName,
            nickname,
        });

        await interaction.editReply(
            `[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)})의 **${cleanJobName}** 명단에 "${nickname}" 님을 추가했습니다!`
        );
    } catch (error) {
        logger.error('등록 중 오류 발생:', error, {
            user: interaction.user.tag,
            guildName,
            jobName: cleanJobName,
            nickname,
        });

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('등록 수정 중 오류가 발생했습니다.').catch(() => {});
        } else {
            await interaction.reply({ content: '등록 중 오류가 발생했습니다.' }).catch(() => {});
        }
    }
};
