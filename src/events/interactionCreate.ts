import { Interaction } from 'discord.js';
import { commandList } from '../commands';
import { logger } from '../utils/logger';

const commandMap = new Map(commandList.map((cmd) => [cmd.data.name, cmd.execute]));

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const handler = commandMap.get(interaction.commandName);
    if (!handler) return;

    try {
        await interaction.deferReply({ flags: 64 });
        await handler(interaction);
    } catch (error) {
        logger.error(`[${interaction.commandName}] 명령어 처리 오류:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('명령어 실행 중 오류가 발생했습니다.');
        }
    }
}
