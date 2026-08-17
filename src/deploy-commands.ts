import { REST, Routes } from 'discord.js';
import { commandJsonList } from '@/commands/index';
import { env } from '@/libs/env';
import { logger } from '@/utils/logger';

(async (): Promise<void> => {
    const rest: REST = new REST({ version: '10' }).setToken(env.token);
    try {
        logger.info('명령어를 글로벌(Global) 커맨드로 디스코드에 등록 중...');
        // Routes.applicationCommands(CLIENT_ID)는 특정 길드가 아닌 애플리케이션 전역에 커맨드를 등록한다.
        // 이렇게 등록하면 봇이 초대되는 모든 서버(Guild)에서 별도 등록 없이 동일한 슬래시 커맨드를 사용할 수 있다.
        // PUT 요청은 전체 커맨드 목록을 한 번에 덮어쓰므로(bulk overwrite) 별도의 초기화(clear) 호출이 필요 없다.
        await rest.put(Routes.applicationCommands(env.clientId), { body: commandJsonList });
        logger.info('글로벌 명령어 등록 완료! (Discord 전체에 반영되기까지 최대 1시간 정도 걸릴 수 있어요)');
    } catch (error: unknown) {
        logger.error('명령어 등록 중 오류 발생:', error);

        const discordErrorCode = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
        if (discordErrorCode === 50001) {
            logger.error(
                [
                    '[명령어 등록 실패: Missing Access(50001)]',
                    '글로벌 커맨드 등록 권한이 없어요. 주로 아래 원인 중 하나예요.',
                    '1) DISCORD_TOKEN이 APPLICATION_ID가 가리키는 애플리케이션의 봇 토큰이 아니거나 재발급되어 더 이상 유효하지 않음',
                    '2) 해당 애플리케이션에 아직 Bot이 생성/활성화되지 않음 (Discord 개발자 포털 > 해당 애플리케이션 > Bot 탭 확인)',
                    'Discord 개발자 포털(https://discord.com/developers/applications)에서 APPLICATION_ID/DISCORD_TOKEN이',
                    '서로 같은 애플리케이션의 값인지 다시 확인한 뒤 배포를 재실행해주세요.',
                ].join('\n')
            );
        }

        // 등록 실패를 빌드/배포 파이프라인에서 명확히 감지할 수 있도록 종료 코드를 남긴다.
        process.exitCode = 1;
    }
})();
