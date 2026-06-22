import { createThreadUrl, findMemberListMessage, findThreadByName, saveMemberListMessage, updateNicknameInContent } from '../services/forumService';
import type { CommandHandlerWithClient } from '../types/forumType';

export const handleUpdate: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    try {
        const guildName = interaction.options.getString('문파명', true).toLowerCase();
        const oldNickname = interaction.options.getString('기존캐릭터명', true).trim();
        const newNickname = interaction.options.getString('새캐릭터명', true).trim();

        const targetThread = await findThreadByName(forumChannel, guildName);

        if (!targetThread) {
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 문파명을 찾지 못했습니다.`);
            return;
        }

        const targetMessage = await findMemberListMessage({
            thread: targetThread,
        });

        if (!targetMessage) {
            await interaction.editReply('해당 포스트 내부에서 양식을 찾지 못했습니다.');
            return;
        }

        const result = updateNicknameInContent({
            content: targetMessage.content,
            oldNickname,
            newNickname,
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
            )}) 명단에서 "${oldNickname}" → "${newNickname}" 으로 수정했습니다.`
        );
    } catch (error) {
        console.error('[Error] handleUpdate 중 예외 발생:', error);
        await interaction.editReply('수정 처리 중 오류가 발생했습니다.').catch(() => {});
    }
};
