import type { Interaction } from 'discord.js';
import { commands } from '@/commands/index';
import { logger } from '@/utils/logger';
import { handleCommandError } from '@/utils/errorHandler';
import { buildErrorEmbed } from '@/utils/embeds';

/**
 * 모든 슬래시 커맨드 인터랙션의 단일 진입점.
 * 커맨드 자체 실행 중 발생한 예외는 handleCommandError(내부적으로 safeReply 사용)가
 * deferred/replied 상태를 판별해 "Interaction already replied" 에러 없이 안전하게 응답한다.
 */
export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    const command = commands.get(interaction.commandName);
    if (!command) {
        logger.warn(`등록되지 않은 커맨드가 호출되었습니다: ${interaction.commandName}`);
        try {
            await interaction.reply({
                embeds: [buildErrorEmbed('알 수 없는 명령어예요', '등록되지 않았거나 오래된 명령어예요. 잠시 후 다시 시도해주세요.')],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('알 수 없는 커맨드에 대한 응답 실패:', error);
        }
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        await handleCommandError(interaction, error, interaction.commandName);
    }
}
