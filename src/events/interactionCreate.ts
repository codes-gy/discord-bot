import { Interaction, MessageFlags } from 'discord.js';
import { commandList } from '../commands';
import { logger } from '../utils/logger';

const commandMap = new Map(commandList.map((cmd) => [cmd.data.name, cmd.execute]));

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const handler = commandMap.get(interaction.commandName);
    if (!handler) return;

    try {
        // 상위 핸들러의 일괄 deferReply를 제거하여 각 커맨드가 공개/비공개 여부를 직접 결정하게 합니다.
        await handler(interaction);
    } catch (error) {
        logger.error(`[${interaction.commandName}] 명령어 처리 오류:`, error);

        // 에러 발생 시 응답 상태에 맞춰 안전하게 메시지 전달
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('명령어 실행 중 오류가 발생했습니다.');
        } else {
            await interaction.reply({
                content: '명령어 실행 중 오류가 발생했습니다.',
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
