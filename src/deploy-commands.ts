import { REST, Routes } from 'discord.js';
import { commandJsonList } from '@/commands/index';
import { env } from '@/libs/env';
import { logger } from '@/utils/logger';

(async (): Promise<void> => {
    const rest: REST = new REST({ version: '10' }).setToken(env.token);
    try {
        logger.info('명령어 디스코드에 등록 중...');
        await rest.put(Routes.applicationCommands(env.clientId), { body: [] });
        if (env.guildId) {
            await rest.put(Routes.applicationGuildCommands(env.clientId, env.guildId), { body: commandJsonList });
        } else {
            await rest.put(Routes.applicationCommands(env.clientId), { body: commandJsonList });
        }
        logger.info('명령어 등록 완료!');
    } catch (error: unknown) {
        logger.error('명령어 등록 중 오류 발생:', error);
    }
})();
