import { Collection } from 'discord.js';
import { createThreadUrl, getAllThreads } from '../services/forumService';
export const handleSearch = async ({ interaction, forumChannel }) => {
    try {
        await interaction.deferReply();
        const rawKeyword = interaction.options.getString('검색어', true);
        const keyword = rawKeyword.toLowerCase();
        // 1. 모든 스레드 가져오기
        const allThreads = await getAllThreads(forumChannel);
        // 2. 1차 필터링: API 호출 없이 스레드 이름에 키워드가 포함된 경우 바로 매칭
        const matchedThreads = allThreads.filter((thread) => thread.name.toLowerCase().includes(keyword));
        // 이름에서 매칭되지 않은 나머지 스레드들
        const remainingThreads = allThreads.filter((thread) => !matchedThreads.includes(thread));
        // 3. 2차 필터링 (병렬 처리): 나머지 스레드들의 본문 및 최근 메시지 뒤지기
        // Promise.all을 사용해 동시에 디스코드 API 요청을 보냅니다.
        const searchPromises = remainingThreads.map(async (thread) => {
            try {
                // 스타터 메시지 확인
                const starterMessage = await thread.fetchStarterMessage().catch(() => null);
                if (starterMessage?.content.toLowerCase().includes(keyword)) {
                    return thread;
                }
                // 최근 메시지 50개 확인
                const messages = await thread.messages.fetch({ limit: 50 }).catch(() => new Collection());
                if (messages.some((msg) => msg.content.toLowerCase().includes(keyword))) {
                    return thread;
                }
            }
            catch (err) {
                console.error(`[Error] 스레드(${thread.id}) 검색 중 오류:`, err);
            }
            return null;
        });
        // 모든 병렬 작업이 끝날 때까지 대기
        const parallelResults = await Promise.all(searchPromises);
        // null이 아닌 (매칭된) 스레드만 걸러서 기존 매칭 리스트에 추가
        for (const thread of parallelResults) {
            if (thread)
                matchedThreads.push(thread);
        }
        // 4. 결과 출력 처리
        if (matchedThreads.length === 0) {
            await interaction.editReply(`"${rawKeyword}" 문구가 포함된 포스트를 찾지 못했습니다.\n\`/등록\` 명령어를 통해 새로 추가해주세요.`);
            return;
        }
        // 출력 가독성 개선 (스레드명에 링크를 깔끔하게 매핑)
        const resultLines = matchedThreads.map((thread) => `• [${thread.name}](${createThreadUrl(interaction.guildId, thread.id)})`);
        await interaction.editReply(`**"${rawKeyword}" 검색 결과 (총 ${matchedThreads.length}개):**\n${resultLines.join('\n')}`);
    }
    catch (error) {
        console.error('[Error] handleSearch 중 예외 발생:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('검색 처리 중 오류가 발생했습니다.');
        }
        else {
            await interaction.reply({ content: '검색 중 오류가 발생했습니다.', ephemeral: true }).catch(() => { });
        }
    }
};
