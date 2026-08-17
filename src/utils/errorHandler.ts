import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { logger } from '@/utils/logger';
import { buildErrorEmbed } from '@/utils/embeds';

/**
 * interaction의 현재 응답 상태(deferred/replied)를 확인한 뒤 알맞은 메서드로 응답한다.
 * 디스코드의 "Interaction has already been acknowledged" 에러를 원천적으로 방지하기 위한
 * 유일한 응답 경로로 사용해야 한다.
 */
export async function safeReply(interaction: ChatInputCommandInteraction, embeds: EmbedBuilder[], ephemeral = true): Promise<void> {
    try {
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ embeds });
            return;
        }
        if (interaction.replied) {
            await interaction.followUp({ embeds, ephemeral });
            return;
        }
        await interaction.reply({ embeds, ephemeral });
    } catch (error) {
        // Unknown interaction(10062) 등 이미 만료된 인터랙션에 대한 응답 실패는
        // 사용자에게 전달할 방법이 없으므로 로그만 남기고 조용히 무시한다.
        logger.error(`[interaction:${interaction.commandName}] 응답 전송 실패:`, error);
    }
}

/**
 * 커맨드 실행 중 발생한 예외를 표준 에러 Embed로 변환해 사용자에게 알리고 로그를 남긴다.
 */
export async function handleCommandError(interaction: ChatInputCommandInteraction, error: unknown, contextLabel: string): Promise<void> {
    logger.error(`[${contextLabel}] 처리 중 오류가 발생했습니다:`, error);
    const description = error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    await safeReply(interaction, [buildErrorEmbed('명령어 처리 중 오류가 발생했어요', description)]);
}
