import { REST, Routes } from 'discord.js';
import { commands } from './commands/commands';
import { env } from './utils/env';

(async () => {
    const rest: REST = new REST({ version: '10' }).setToken(env.token);
    try {
        console.log('명령어 디스코드에 등록 중...');
        await rest.put(Routes.applicationCommands(env.clientId), {
            body: commands,
        });
        console.log('명령어 등록 완료!');
    } catch (error: unknown) {
        console.error('명령어 등록 중 오류 발생:', error);
    }
})();
