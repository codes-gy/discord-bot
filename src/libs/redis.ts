import { createClient, type RedisClientType } from 'redis';
import { env } from '@/libs/env';
import { logger } from '@/utils/logger';

const TTS_CHANNEL_KEY_PREFIX = 'tts:channel:';
const TTS_USER_LANG_KEY_PREFIX = 'tts:userLang:';

let client: RedisClientType | null = null;

/**
 * 등록된 TTS 채널 ID의 인메모리 캐시. messageCreate 이벤트는 메시지마다 호출되므로
 * 매번 Redis 왕복을 하지 않고 캐시를 우선 조회해 지연을 최소화한다.
 * 값이 null이면 "해당 서버는 TTS 미등록"을 의미한다.
 */
const ttsChannelCache = new Map<string, string | null>();

/** 사용자별 TTS 언어 설정 캐시. ttsChannelCache와 동일한 이유로 둔다. 값이 없으면 기본 언어(ko)를 쓴다. */
const userLangCache = new Map<string, string | null>();

/**
 * Redis 연결을 초기화한다. 재연결은 지수 백오프(최대 10초 간격)로 처리하며,
 * 연결 이벤트 자체에서 발생하는 에러는 여기서 흡수해 프로세스 전체가 죽지 않도록 한다.
 */
export async function connectRedis(): Promise<void> {
    if (client && client.isOpen) {
        return;
    }

    client = createClient({
        url: env.redisUrl,
        socket: {
            reconnectStrategy: (retries: number) => {
                const delay = Math.min(1000 * 2 ** retries, 10000);
                logger.warn(`Redis 재연결 시도 #${retries + 1} (${delay}ms 후)`);
                return delay;
            },
        },
    });

    client.on('error', (error: unknown) => {
        logger.error('Redis 클라이언트 에러:', error);
    });
    client.on('reconnecting', () => {
        logger.warn('Redis 재연결 중...');
    });
    client.on('ready', () => {
        logger.info('Redis 연결 완료');
    });

    await client.connect();
}

function getClient(): RedisClientType {
    if (!client || !client.isOpen) {
        throw new Error('Redis 클라이언트가 아직 연결되지 않았습니다.');
    }
    return client;
}

/**
 * 등록된 TTS 채널 ID를 조회한다. 캐시를 우선 사용하고, 캐시 미스일 때만 Redis를 조회한다.
 * Redis 장애 시에도 봇 전체가 멈추지 않도록 호출부(messageCreate)에서 null을
 * "등록 안 됨"과 동일하게 취급할 수 있게 에러를 흡수한다.
 */
export async function getTtsChannel(guildId: string): Promise<string | null> {
    if (ttsChannelCache.has(guildId)) {
        return ttsChannelCache.get(guildId) ?? null;
    }

    try {
        const value = await getClient().get(`${TTS_CHANNEL_KEY_PREFIX}${guildId}`);
        const normalized = value ?? null;
        ttsChannelCache.set(guildId, normalized);
        return normalized;
    } catch (error) {
        logger.error(`TTS 채널 조회 실패 (guildId=${guildId}):`, error);
        return null;
    }
}

export async function setTtsChannel(guildId: string, channelId: string): Promise<void> {
    await getClient().set(`${TTS_CHANNEL_KEY_PREFIX}${guildId}`, channelId);
    ttsChannelCache.set(guildId, channelId);
}

export async function removeTtsChannel(guildId: string): Promise<void> {
    await getClient().del(`${TTS_CHANNEL_KEY_PREFIX}${guildId}`);
    ttsChannelCache.set(guildId, null);
}

/**
 * 사용자별 TTS 언어 설정을 조회한다 (기획서 F-13). 설정한 적이 없으면 null을 반환하며,
 * 호출부(messageCreate.ts)가 이를 기본 언어(ko)로 취급한다.
 */
export async function getUserTtsLang(userId: string): Promise<string | null> {
    if (userLangCache.has(userId)) {
        return userLangCache.get(userId) ?? null;
    }

    try {
        const value = await getClient().get(`${TTS_USER_LANG_KEY_PREFIX}${userId}`);
        const normalized = value ?? null;
        userLangCache.set(userId, normalized);
        return normalized;
    } catch (error) {
        logger.error(`TTS 사용자 언어 설정 조회 실패 (userId=${userId}):`, error);
        return null;
    }
}

export async function setUserTtsLang(userId: string, lang: string): Promise<void> {
    await getClient().set(`${TTS_USER_LANG_KEY_PREFIX}${userId}`, lang);
    userLangCache.set(userId, lang);
}

const WELCOME_CHANNEL_KEY_PREFIX = 'welcome:channel:';

/** 환영 메시지를 보낼 채널 캐시. ttsChannelCache와 동일한 패턴이다. */
const welcomeChannelCache = new Map<string, string | null>();

/**
 * 등록된 환영 메시지 채널 ID를 조회한다 (기획서 F-14).
 */
export async function getWelcomeChannel(guildId: string): Promise<string | null> {
    if (welcomeChannelCache.has(guildId)) {
        return welcomeChannelCache.get(guildId) ?? null;
    }

    try {
        const value = await getClient().get(`${WELCOME_CHANNEL_KEY_PREFIX}${guildId}`);
        const normalized = value ?? null;
        welcomeChannelCache.set(guildId, normalized);
        return normalized;
    } catch (error) {
        logger.error(`환영 채널 조회 실패 (guildId=${guildId}):`, error);
        return null;
    }
}

export async function setWelcomeChannel(guildId: string, channelId: string): Promise<void> {
    await getClient().set(`${WELCOME_CHANNEL_KEY_PREFIX}${guildId}`, channelId);
    welcomeChannelCache.set(guildId, channelId);
}

export async function removeWelcomeChannel(guildId: string): Promise<void> {
    await getClient().del(`${WELCOME_CHANNEL_KEY_PREFIX}${guildId}`);
    welcomeChannelCache.set(guildId, null);
}

const STATS_TOTAL_KEY_PREFIX = 'stats:totalPlays:';
const STATS_TRACK_KEY_PREFIX = 'stats:trackPlays:'; // Sorted Set (member: 트랙 제목, score: 누적 재생 횟수)
const STATS_DAILY_KEY_PREFIX = 'stats:daily:';
const STATS_DAILY_TTL_SECONDS = 60 * 60 * 48; // 이틀 뒤 자동 만료 (하루 치 집계만 필요하므로 여유를 둔 값)

function todayDateKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC 기준)
}

export interface GuildStats {
    totalPlays: number;
    todayPlays: number;
    topTracks: { title: string; count: number }[];
}

/**
 * 곡 재생 1건을 서버 통계에 기록한다 (기획서 F-16). 실패해도 실제 음악 재생을 막아선 안 되므로
 * 에러를 흡수하고 로그만 남긴다 (호출부인 playNext의 정상 흐름을 절대 방해하지 않기 위함).
 */
export async function recordTrackPlay(guildId: string, trackTitle: string): Promise<void> {
    try {
        const redisClient = getClient();
        const dailyKey = `${STATS_DAILY_KEY_PREFIX}${guildId}:${todayDateKey()}`;
        await Promise.all([
            redisClient.incr(`${STATS_TOTAL_KEY_PREFIX}${guildId}`),
            redisClient.zIncrBy(`${STATS_TRACK_KEY_PREFIX}${guildId}`, 1, trackTitle),
            redisClient.incr(dailyKey).then(() => redisClient.expire(dailyKey, STATS_DAILY_TTL_SECONDS)),
        ]);
    } catch (error) {
        logger.error(`재생 통계 기록 실패 (guildId=${guildId}):`, error);
    }
}

/**
 * /통계 커맨드용 집계 조회. 누적 재생 수, 오늘 재생 수, 최다 재생곡 Top 5를 반환한다.
 */
export async function getGuildStats(guildId: string): Promise<GuildStats> {
    const redisClient = getClient();
    const dailyKey = `${STATS_DAILY_KEY_PREFIX}${guildId}:${todayDateKey()}`;

    const [totalRaw, todayRaw, topRaw] = await Promise.all([
        redisClient.get(`${STATS_TOTAL_KEY_PREFIX}${guildId}`),
        redisClient.get(dailyKey),
        redisClient.zRangeWithScores(`${STATS_TRACK_KEY_PREFIX}${guildId}`, 0, 4, { REV: true }),
    ]);

    return {
        totalPlays: Number(totalRaw ?? 0),
        todayPlays: Number(todayRaw ?? 0),
        topTracks: topRaw.map((item) => ({ title: item.value, count: item.score })),
    };
}

const REACTION_ROLE_KEY_PREFIX = 'reactionrole:'; // Hash: field=이모지 키, value=역할 ID (메시지 하나에 여러 이모지 바인딩 가능)

/**
 * 리액션 역할 바인딩을 등록한다 (기획서 F-15). 같은 메시지에 이모지별로 여러 개 등록할 수 있다.
 */
export async function setReactionRole(messageId: string, emojiKey: string, roleId: string): Promise<void> {
    await getClient().hSet(`${REACTION_ROLE_KEY_PREFIX}${messageId}`, emojiKey, roleId);
}

export async function removeReactionRole(messageId: string, emojiKey: string): Promise<void> {
    await getClient().hDel(`${REACTION_ROLE_KEY_PREFIX}${messageId}`, emojiKey);
}

/**
 * 메시지 반응 이벤트마다 호출되므로, 캐시 없이 매번 Redis를 직접 조회한다
 * (messageCreate의 TTS 채널 조회와 달리 호출 빈도가 훨씬 낮아 캐시의 이점이 적다).
 */
export async function getReactionRole(messageId: string, emojiKey: string): Promise<string | null> {
    try {
        const value = await getClient().hGet(`${REACTION_ROLE_KEY_PREFIX}${messageId}`, emojiKey);
        return value ?? null;
    } catch (error) {
        logger.error(`리액션 역할 조회 실패 (messageId=${messageId}, emojiKey=${emojiKey}):`, error);
        return null;
    }
}
