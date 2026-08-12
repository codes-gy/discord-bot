import { Message } from 'discord.js';
import { ttsService } from '../services/ttsService';
import { logger } from '../utils/logger';

export async function handleMessageCreate(message: Message): Promise<void> {
    logger.info('[메시지 수신]:', message.content);

    if (message.author.bot) return;

    await ttsService.processMessageTts(message);
}
