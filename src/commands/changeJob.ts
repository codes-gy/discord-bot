import { changeJobInContent, createThreadUrl, findMemberListMessage, findThreadByName, saveMemberListMessage } from '../services/forumService';
import type { CommandHandlerWithClient, JobType } from '../types/forumType';

export const handleChangeJob: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    try {
        const guildName = interaction.options.getString('문파명', true).toLowerCase();
        const nickname = interaction.options.getString('캐릭터명', true).trim();
        const newJobTarget = interaction.options.getString('직업명', true) as JobType;

        const targetThread = await findThreadByName(forumChannel, guildName);

        if (!targetThread) {
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 포스트를 찾지 못했습니다.`);
            return;
        }

        const targetMessage = await findMemberListMessage({
            thread: targetThread,
        });

        if (!targetMessage) {
            await interaction.editReply('해당 포스트 내부에서 명단 양식을 찾지 못했습니다.');
            return;
        }

        const result = changeJobInContent({
            content: targetMessage.content,
            nickname,
            newJobTarget,
        });

        if (!result.success) {
            await interaction.editReply(result.message);
            return;
        }

        await saveMemberListMessage({
            client,
            thread: targetThread,
            targetMessage,
            updatedContent: result.message,
        });

        await interaction.editReply(
            `[${targetThread.name}](${createThreadUrl(
                interaction.guildId,
                targetThread.id
            )})에서 "${nickname}" 님의 직업을 **${newJobTarget.replace('### ', '')}**로 변경했습니다.`
        );
    } catch (error) {
        console.error('[Error] handleChangeJob 중 예외 발생:', error);
        await interaction.editReply('직업 변경 중 오류가 발생했습니다.').catch(() => {});
    }
};
