import { createClient } from 'redis';
import { env } from './env';
import { logger } from './logger';
const isTLS = env.redisUrl?.startsWith('rediss://');
export const redisClient = createClient({
    url: env.redisUrl,
    socket: isTLS
        ? {
              tls: true,
              rejectUnauthorized: false,
          }
        : undefined,
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
redisClient.on('connect', () => logger.info('Redis 서버에 연결되었습니다.'));

export async function connectRedis(): Promise<void> {
    if (!redisClient.isOpen && !redisClient.isReady) {
        await redisClient.connect();
    }
}
