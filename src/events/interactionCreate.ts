import { Interaction, MessageFlags } from 'discord.js';
import { commandList } from '../commands';
import { logger } from '../utils/logger';

const commandMap = new Map(commandList.map((cmd) => [cmd.data.name, cmd.execute]));

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const handler = commandMap.get(interaction.commandName);
    if (!handler) return;

    try {
        await handler(interaction);
    } catch (error) {
        logger.error(`[${interaction.commandName}] 명령어 처리 오류:`, error);

        // 에러 발생 시 응답 상태에 맞춰 안전하게 메시지 전달
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('명령어 실행 중 오류가 발생했습니다.');
            } else {
                await interaction.reply({
                    content: '명령어 실행 중 오류가 발생했습니다.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (replyError) {
            logger.error(`[${interaction.commandName}] 에러 응답 전송 실패:`, replyError);
        }
    }
}
