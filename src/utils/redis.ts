import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';
import { env } from './env';

let redisClient: RedisClientType;

export const initRedis = (): RedisClientType => {
    const redisUrl = env.REDIS_URL || 'redis://127.0.0.1:6379';

    redisClient = createClient({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    logger.error('Redis 재연결 시도 횟수 초과(10회). 연결을 중단합니다.');
                    return new Error('Redis connection lost');
                }
                const delay = Math.min(retries * 500, 3000);
                logger.warn(`Redis 연결 끊김. ${delay}ms 후 재연결 시도 중... (시도: ${retries}/10)`);
                return delay;
            },
        },
    });

    redisClient.on('error', (err) => logger.error('Redis 클라이언트 에러:', err));
    redisClient.on('connect', () => logger.info('Redis 서버와 최초 연결을 시도합니다...'));
    redisClient.on('ready', () => logger.info('🚀 Redis 준비 완료! 캐싱 레이어가 정상 작동합니다.'));

    return redisClient;
};

/**
 * 앱이 구동될 때 최초 1회 안전하게 연결을 수행하는 함수
 */
export const connectRedis = async (): Promise<void> => {
    if (!redisClient) {
        initRedis();
    }

    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
};

// 다른 파일(.ts)에서 redisClient.get() / .set()을 쓸 수 있도록 내보내기
export { redisClient };
