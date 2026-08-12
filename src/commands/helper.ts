import { logger } from '../utils/logger';

export const handleHelp: CommandHandler = async ({ interaction }) => {
    try {
        logger.info('도움말 명령어 실행', {
            user: interaction.user.tag,
        });

        const message = ['**젤리봇 도움말**', ''].join('\n');

        await interaction.editReply(message);
    } catch (error) {
        logger.error('도움말 조회 중 오류 발생', error, {
            user: interaction.user.tag,
        });

        await interaction.editReply('도움말을 불러오는 중 오류가 발생했습니다.').catch(() => {});
    }
};
