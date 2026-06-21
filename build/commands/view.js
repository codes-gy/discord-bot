import { createThreadUrl, findMemberListMessage, findThreadByName } from '../services/forumService';
export const handleView = async ({ interaction, forumChannel }) => {
    try {
        await interaction.deferReply();
        const guildName = interaction.options.getString('문파명', true).toLowerCase();
        // 1. 문파 스레드 검색
        const targetThread = await findThreadByName(forumChannel, guildName);
        if (!targetThread) {
            await interaction.editReply(`제목에 "${guildName}"이(가) 포함된 문파 포스트를 찾지 못했습니다.`);
            return;
        }
        // 2. 명단 메시지 검색
        const targetMessage = await findMemberListMessage({ thread: targetThread });
        if (!targetMessage) {
            await interaction.editReply(`[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)}) 포스트 내부에서 \`## 문파원 정보 안내\` 양식을 찾지 못했습니다.`);
            return;
        }
        // 3. 디스코드 2000자 제한 방어 코드 및 응답 생성
        const header = `**[${targetThread.name}](${createThreadUrl(interaction.guildId, targetThread.id)}) 명단 조회 결과:**\n\n`;
        let content = targetMessage.content;
        // 헤더 길이와 본문 길이를 합쳐서 2000자가 넘을 경우 대처
        if (header.length + content.length > 2000) {
            const allowedLength = 2000 - header.length - 20; // 여유 공간 확보
            content = content.slice(0, allowedLength) + '\n\n...(명단이 너무 길어 일부 생략되었습니다.)';
        }
        await interaction.editReply(`${header}${content}`);
    }
    catch (error) {
        console.error('[Error] handleView 중 예외 발생:', error);
        // 상호작용 상태에 따른 안전한 에러 메시지 처리
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('명단을 조회하는 도중 오류가 발생했습니다.');
        }
        else {
            await interaction.reply({ content: '명단을 조회하는 도중 오류가 발생했습니다.', ephemeral: true }).catch(() => { });
        }
    }
};
