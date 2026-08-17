import path from 'path';
import fs from 'fs';
import http from 'http';
import { Events } from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';
import { client } from '@/libs/discordClient';
import { handleMessageCreate } from '@/events/messageCreate';
import { handleInteractionCreate } from '@/events/interactionCreate';
import { handleVoiceStateUpdate } from '@/events/voiceStateUpdate';
import { logger } from '@/utils/logger';
import { env } from '@/libs/env';
import { connectRedis } from '@/libs/redis';
import { initYoutubeCookies } from '@/services/audio/youtubeService';

// Render 등 PaaS가 헬스체크용으로 요구하는 포트 바인딩 유지
http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('젤리봇 실행 중!');
}).listen(env.port, () => {
    logger.info(`server listening on port ${env.port}`);
});

client.once(Events.ClientReady, (readyClient) => {
    logger.info(`젤리봇 연결 성공 (${readyClient.user.tag})`);
});

// 이벤트 리스너 연결
client.on(Events.MessageCreate, (message) => {
    handleMessageCreate(message).catch((error: unknown) => {
        logger.error('messageCreate 핸들러에서 처리되지 않은 오류:', error);
    });
});
client.on(Events.InteractionCreate, (interaction) => {
    handleInteractionCreate(interaction).catch((error: unknown) => {
        logger.error('interactionCreate 핸들러에서 처리되지 않은 오류:', error);
    });
});
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    handleVoiceStateUpdate(oldState, newState).catch((error: unknown) => {
        logger.error('voiceStateUpdate 핸들러에서 처리되지 않은 오류:', error);
    });
});

client.on(Events.Error, (error) => {
    logger.error('Discord 클라이언트 게이트웨이 에러:', error);
});
client.on(Events.ShardDisconnect, (event, shardId) => {
    logger.warn(`Discord 게이트웨이 연결이 끊어졌습니다 (shardId=${shardId}, code=${event.code}). discord.js가 자동 재연결을 시도합니다.`);
});
client.on(Events.ShardReconnecting, (shardId) => {
    logger.info(`Discord 게이트웨이 재연결 시도 중... (shardId=${shardId})`);
});
client.on(Events.ShardResume, (shardId) => {
    logger.info(`Discord 게이트웨이 재연결에 성공했습니다. (shardId=${shardId})`);
});

// 네트워크 유실/미처리 예외로 인해 프로세스 전체가 죽는 것을 방지 (비기능 요구사항)
process.on('unhandledRejection', (reason) => {
    logger.error('처리되지 않은 Promise 거부(unhandledRejection):', reason);
});
process.on('uncaughtException', (error) => {
    logger.error('처리되지 않은 예외(uncaughtException):', error);
});

function initCookie(): void {
    if (process.env.YOUTUBE_COOKIES_BASE64) {
        const rootCookiePath = path.join(process.cwd(), 'cookies.txt');
        const cookieData = Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf-8');

        fs.writeFileSync(rootCookiePath, cookieData);
        logger.info('cookies.txt 생성이 완료되었습니다.');
    }
}

async function bootstrap(): Promise<void> {
    try {
        // Opus 인코더(@discordjs/opus 등)와 암호화 라이브러리(sodium 등)가 실제로 로드됐는지 확인하기 위한 진단 로그.
        // "봇은 입장하는데 소리가 안 나옴" 증상의 원인 파악에 필요해 배포 로그에 항상 남긴다.
        logger.info(`@discordjs/voice 의존성 리포트:\n${generateDependencyReport()}`);
        initCookie();
        await initYoutubeCookies();
        await connectRedis(); // Redis 서버 연결 (TTS 채널 등록 영속화용)
        await client.login(env.token);
    } catch (error) {
        logger.error('앱 실행 초기화 오류:', error);
        process.exitCode = 1;
    }
}

bootstrap();
