import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import { handleMessageCreate } from './events/messageCreate';
import { handleInteractionCreate } from './events/interactionCreate';
import { logger } from './utils/logger';
import { env } from './utils/env';
import { connectRedis } from './utils/redis';

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // 텍스트 내용 수신 권한
        GatewayIntentBits.GuildVoiceStates, // 음성 채널 상태 권한
        GatewayIntentBits.GuildMembers, // Server Members Intent
        GatewayIntentBits.GuildPresences, // Presence Intent
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildScheduledEvents,
    ],
    partials: [
        Partials.Channel, // DM 채널 이벤트를 정상 수신하기 위해 필수
        Partials.Message, // 안 읽은/이전 메시지 이벤트 처리
        Partials.GuildMember, // 서버 멤버 데이터 처리
    ],
});
client.once(Events.ClientReady, (readyClient) => {
    logger.info(`젤리봇 연결 성공`);
});

// 이벤트 리스너 연결
client.on('messageCreate', handleMessageCreate);
client.on('interactionCreate', handleInteractionCreate);

async function bootstrap() {
    try {
        await connectRedis(); // Redis 서버 연결

        await client.login(env.token); // 디스코드 로그인
    } catch (error) {
        logger.error('앱 실행 초기화 오류:', error);
    }
}

bootstrap();
