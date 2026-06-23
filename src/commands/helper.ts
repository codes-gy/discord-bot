import type { CommandHandler } from '../types/forumType';
import { logger } from '../utils/logger';

export const handleHelp: CommandHandler = async ({ interaction }) => {
    try {
        logger.info('도움말 명령어 실행', {
            user: interaction.user.tag,
        });

        const message = [
            '**젤리봇 도움말**',
            '',
            '`/생성 문파명`',
            '채널에 새로운 문파 포스트를 작성합니다.',
            '',
            '',
            '`/검색 캐릭터명`',
            '게시글 본문, 최근 메시지에서 캐릭터명을 찾습니다.',
            '',
            '`/조회 문파명`',
            '해당 포스트의 본문을 조회합니다.',
            '',
            '`/등록 문파명 직업명 캐릭터명`',
            '선택한 직업에 캐릭터명을 추가합니다.',
            '',
            '`/수정 문파명 기존캐릭터명 새캐릭터명`',
            '등록된 캐릭터명을 수정합니다.',
            '',
            '`/삭제 문파명 캐릭터명`',
            '문파 포스트에서 캐릭터명을 삭제합니다.',
            '',
            '`/통계 문파명`',
            '해당 포스트의 총 인원과 직업별 인원을 확인합니다.',
            '',
            '`/직업변경 문파명 캐릭터명 직업명`',
            '캐릭터명을 다른 직업 항목으로 이동합니다.',
            '',
            '`/중복검사`',
            '전체 포스트에서 중복 등록된 캐릭터명을 확인합니다.',
        ].join('\n');

        await interaction.editReply(message);
    } catch (error) {
        logger.error('도움말 조회 중 오류 발생', error, {
            user: interaction.user.tag,
        });

        await interaction.editReply('도움말을 불러오는 중 오류가 발생했습니다.').catch(() => {});
    }
};
