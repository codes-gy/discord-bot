import { createThreadUrl, findMemberListMessage, getAllThreads } from '../services/forumService';
import { CommandHandler } from '../types/forumType';
import { logger } from '../utils/logger';
import { getSubjectParticle } from '../utils/korean';

export const handleView: CommandHandler = async ({ interaction, forumChannel }) => {
    const guildName = interaction.options.getString('문파명', true).toLowerCase();
    const particle = getSubjectParticle(guildName);
    try {
        logger.info('조회 명령어 실행', {
            user: interaction.user.tag,
            guildName,
        });

        const threads = await getAllThreads(forumChannel);

        const targetThread = threads.find((thread) => thread.name.toLowerCase().trim() === guildName);
        if (!targetThread) {
            logger.warn('조회 실패(제목 없음)', {
                guildName,
            });
            await interaction.editReply(`제목에 "${guildName}"${particle} 포함된 문파명을 찾지 못했습니다.`);
            return;
        }

        const targetMessage = await findMemberListMessage({ thread: targetThread });
        if (!targetMessage) {
            logger.warn('조회 실패(양식 없음)', {
                threadName: targetThread.name,
            });
            await interaction.editReply(
                `[${targetThread.name}](${createThreadUrl(
                    interaction.guildId,
                    targetThread.id
                )}) 포스트 내부에서 \`## 문파원 정보 안내\` 양식을 찾지 못했습니다.`
            );
            return;
        }

        const header = `**[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)}) 명단 조회 결과:**\n\n`;
        let content = targetMessage.content;

        if (header.length + content.length > 2000) {
            const allowedLength = 2000 - header.length - 20; // 여유 공간 확보
            content = content.slice(0, allowedLength) + '\n\n...(명단이 너무 길어 일부 생략되었습니다.)';

            logger.warn('조회 결과 일부 생략', {
                threadName: targetThread.name,
                originalLength: targetMessage.content.length,
                setLength: content.length,
            });
        }

        logger.info('조회 완료', {
            threadName: targetThread.name,
            contentLength: targetMessage.content.length,
        });

        await interaction.editReply(`${header}${content}`);
    } catch (error) {
        logger.error('조회 중 오류 발생', error, {
            user: interaction.user.tag,
            guildName,
        });

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('명단을 조회하는 도중 오류가 발생했습니다.').catch(() => {});
        } else {
            await interaction.reply({ content: '명단을 조회하는 도중 오류가 발생했습니다.' }).catch(() => {});
        }
    }
};
