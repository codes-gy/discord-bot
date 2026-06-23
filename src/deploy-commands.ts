import { REST, Routes } from 'discord.js';
import { commands } from './commands/commands';
import { env } from './utils/env';
import { logger } from './utils/logger';

(async () => {
    const rest: REST = new REST({ version: '10' }).setToken(env.token);
    try {
        logger.info('명령어 디스코드에 등록 중...');
        await rest.put(Routes.applicationCommands(env.clientId), {
            body: commands,
        });
        logger.info('명령어 등록 완료!');
    } catch (error: unknown) {
        logger.error('명령어 등록 중 오류 발생:', error);
    }
})();
