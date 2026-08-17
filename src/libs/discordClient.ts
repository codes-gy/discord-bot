import { Client, GatewayIntentBits, Partials } from 'discord.js';

/**
 * Discord Client 싱글톤 인스턴스.
 * app.ts가 이 인스턴스에 이벤트를 연결하고 로그인시킨다.
 * services 레이어(자동 퇴장/재연결 알림 등)에서도 순환 참조 없이 바로 import해서 쓸 수 있도록
 * 별도 leaf 모듈로 분리했다.
 */
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // 텍스트 내용 수신 권한 (TTS 채널 감지에 필수)
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
