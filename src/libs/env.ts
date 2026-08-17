import 'dotenv/config';

/**
 * 환경 변수 파싱 및 검증.
 * 필수 값이 없으면 부팅 즉시 명확한 에러 메시지와 함께 프로세스를 종료시켜
 * "토큰이 없는데 게이트웨이 연결을 시도하다 알 수 없는 에러로 죽는" 상황을 방지한다.
 */
function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
        throw new Error(`[ENV] 필수 환경 변수 ${key}가 설정되지 않았습니다. .env 파일을 확인해주세요.`);
    }
    return value;
}

function optionalEnv(key: string): string | null {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
        return null;
    }
    return value;
}

export const env = {
    token: requireEnv('DISCORD_TOKEN'),
    clientId: requireEnv('APPLICATION_ID'),
    guildId: optionalEnv('GUILD_ID'),
    redisUrl: requireEnv('REDIS_URL'),
    youtubeCookie: optionalEnv('YOUTUBE_COOKIE'),
    youtubeCookiesBase64: optionalEnv('YOUTUBE_COOKIES_BASE64'),
    port: Number(process.env.PORT ?? 10000),
};
