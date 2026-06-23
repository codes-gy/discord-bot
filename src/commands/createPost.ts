import type { CommandHandler } from '../types/forumType';
import { logger } from '../utils/logger';
import { findThreadByExactName } from '../services/forumService';

const MEMBER_TEMPLATE = `## 문파원 정보 안내

### 격수

### 도사

### 술사`;

export const handleCreatePost: CommandHandler = async ({ interaction, forumChannel }) => {
    const guildName = interaction.options.getString('문파명', true).trim();

    try {
        logger.info('생성 명령어 실행', {
            user: interaction.user.tag,
            guildName,
        });

        const existingThread = await findThreadByExactName(forumChannel, guildName);

        if (existingThread) {
            await interaction.editReply(`이미 "${guildName}" 포스트가 존재합니다.`);
            return;
        }

        const post = await forumChannel.threads.create({
            name: guildName,
            message: {
                content: MEMBER_TEMPLATE,
            },
        });

        logger.info('포스트 생성 완료', {
            user: interaction.user.tag,
            threadName: post.name,
            threadId: post.id,
        });

        await interaction.editReply(`"${guildName}" 포스트를 생성했습니다.`);
    } catch (error) {
        logger.error('포스트 생성 중 오류 발생', error, {
            user: interaction.user.tag,
            guildName,
        });

        await interaction.editReply('포스트 생성 중 오류가 발생했습니다.').catch(() => {});
    }
};
