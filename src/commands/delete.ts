import { ChatInputCommandInteraction, Client, ForumChannel } from 'discord.js';
import { createThreadUrl, findMemberListMessage, findThreadByName, removeNicknameFromContent, saveMemberListMessage } from '../services/forumService';
import { CommandHandlerWithClient } from '../types/forumType';

export const handleDelete: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    try {
        // 응답 지연 처리 (3초 제한 연장)
        await interaction.deferReply();

        const guildName = interaction.options.getString('문파명', true).toLowerCase();
        const nickname = interaction.options.getString('캐릭터명', true).trim();

        // 1. 문파 스레드 찾기
        const targetThread = await findThreadByName(forumChannel, guildName);
        if (!targetThread) {
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 문파 포스트를 찾지 못했습니다.`);
            return;
        }

        // 2. 명단 메시지 찾기
        const targetMessage = await findMemberListMessage({ thread: targetThread }); // 만약 서비스 파라미터가 객체 타입이라면 확인 필요
        if (!targetMessage) {
            await interaction.editReply('해당 포스트 내부에서 명단 양식을 찾지 못했습니다.');
            return;
        }

        // 3. 명단에서 닉네임 삭제 연산
        const result = removeNicknameFromContent({ content: targetMessage.content, nickname }); // 만약 서비스 파라미터가 객체 타입이라면 확인 필요
        if (!result.success) {
            await interaction.editReply(result.message);
            return;
        }

        // 4. 변경된 명단 저장 (★ 오류 수정: 서비스 양식에 맞게 객체 구조로 전달)
        await saveMemberListMessage({
            client,
            thread: targetThread,
            targetMessage,
            updatedContent: result.message, // 서비스 결과의 message에 수정된 전체 텍스트가 담겨있음
        });

        // 5. 성공 메시지 반환
        await interaction.editReply(
            `[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)}) 명단에서 "${nickname}" 님을 성공적으로 삭제했습니다.`
        );
    } catch (error) {
        console.error('[Error] handleDelete 수행 중 오류 발생:', error);

        // 방어 코드: 인터랙션 응답 상태에 따라 분기 처리
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('삭제 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        } else {
            await interaction.reply({ content: '삭제 처리 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
        }
    }
};
