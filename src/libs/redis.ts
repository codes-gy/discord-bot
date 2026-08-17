import { createClient, type RedisClientType } from 'redis';
import { env } from '@/libs/env';
import { logger } from '@/utils/logger';

const TTS_CHANNEL_KEY_PREFIX = 'tts:channel:';

let client: RedisClientType | null = null;

/**
 * 등록된 TTS 채널 ID의 인메모리 캐시. messageCreate 이벤트는 메시지마다 호출되므로
 * 매번 Redis 왕복을 하지 않고 캐시를 우선 조회해 지연을 최소화한다.
 * 값이 null이면 "해당 서버는 TTS 미등록"을 의미한다.
 */
const ttsChannelCache = new Map<string, string | null>();

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
