import { createThreadUrl, findMemberListMessage, findThreadByName, parseMemberStats } from '../services/forumService';
import type { CommandHandler, JobType } from '../types/forumType';
import { logger } from '../utils/logger';

const JOB_LABEL: Record<JobType, string> = {
    '### 격수': '격수',
    '### 도사': '도사',
    '### 술사': '술사',
};

export const handleStats: CommandHandler = async ({ interaction, forumChannel }) => {
    const guildName = interaction.options.getString('문파명', true).toLowerCase();
    try {
        logger.info('통계 명령어 실행', {
            user: interaction.user.tag,
            guildName,
        });

        const targetThread = await findThreadByName(forumChannel, guildName);

        if (!targetThread) {
            logger.info('통계 실패(제목 없음)', {
                guildName,
            });
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 포스트를 찾지 못했습니다.`);
            return;
        }

        const targetMessage = await findMemberListMessage({
            thread: targetThread,
        });

        if (!targetMessage) {
            logger.info('통계 실패(양식 없음)', {
                threadName: targetThread.name,
            });
            await interaction.editReply('해당 포스트 내부에서 명단 양식을 찾지 못했습니다.');
            return;
        }

        const stats = parseMemberStats(targetMessage.content);

        const jobLines = Object.entries(stats.byJob)
            .map(([job, members]) => {
                const label = JOB_LABEL[job as JobType];
                return `- ${label}: ${members.length}명`;
            })
            .join('\n');

        let responseMessage = `**[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)}) 현황**\n\n총 인원: ${stats.total}명\n${jobLines}`;

        if (stats.duplicates.length > 0) {
            responseMessage += `\n\n 중복된 캐릭터명이 있습니다: ${stats.duplicates.join(', ')}`;
        }

        logger.info('통계 조회 완료', {
            threadName: targetThread.name,
            total: stats.total,
            duplicates: stats.duplicates.length,
        });

        await interaction.editReply(responseMessage);
    } catch (error) {
        logger.error('통계 조회 중 오류 발생', error, {
            user: interaction.user.tag,
            guildName,
        });
        await interaction.editReply('통계 조회 중 오류가 발생했습니다.').catch(() => {});
    }
};
