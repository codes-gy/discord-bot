import { addNicknameToContent, createThreadUrl, findMemberListMessage, findThreadByName, saveMemberListMessage } from '../services/forumService';
import { CommandHandlerWithClient, JobType } from '../types/forumType';

export const handleRegister: CommandHandlerWithClient = async ({ interaction, forumChannel, client }) => {
    try {
        const guildName = interaction.options.getString('문파명', true).toLowerCase();
        const jobTarget = interaction.options.getString('직업명', true) as JobType;
        const nickname = interaction.options.getString('캐릭터명', true).trim();

        // 1. 문파 스레드 검색
        const targetThread = await findThreadByName(forumChannel, guildName);
        if (!targetThread) {
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 문파 포스트를 찾지 못했습니다.`);
            return;
        }

        // 2. 명단 메시지 검색 (★ 오류 수정: 객체 형태로 전달)
        const targetMessage = await findMemberListMessage({ thread: targetThread });
        if (!targetMessage) {
            await interaction.editReply('해당 문파 포스트에서 양식을 찾지 못했습니다.');
            return;
        }

        // 3. 명단에 닉네임 추가 연산 (★ 오류 수정: 객체 형태로 전달)
        const result = addNicknameToContent({
            content: targetMessage.content,
            jobTarget,
            nickname,
        });

        if (!result.success) {
            await interaction.editReply(result.message);
            return;
        }

        // 4. 변경된 명단 저장 (★ 오류 수정: 객체 형태로 전달)
        await saveMemberListMessage({
            client,
            thread: targetThread,
            targetMessage,
            updatedContent: result.message,
        });

        // 마크다운 서식이 섞여있을 경우를 대비한 깔끔한 직업명 파싱
        const cleanJobName = jobTarget.replace(/^[#\s]+/, '').trim();

        // 5. 성공 메시지 반환
        await interaction.editReply(
            `[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)})의 **${cleanJobName}** 명단에 "${nickname}" 님을 추가했습니다!`
        );
    } catch (error) {
        console.error('[Error] handleRegister 중 예외 발생:', error);

        // 인터랙션 상태에 따른 안전한 에러 처리
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('등록 수정 중 오류가 발생했습니다.').catch(() => {});
        } else {
            await interaction.reply({ content: '등록 중 오류가 발생했습니다.' }).catch(() => {});
        }
    }
};
