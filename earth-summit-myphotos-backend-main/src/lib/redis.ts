import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (!redisClient) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://redis:6379',
        socket: {
          connectTimeout: 5000,
        },
      });

      redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      await redisClient.connect();
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      redisClient = null;
    }
  }

  return redisClient;
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const data = await client.get(key);
    if (!data) return null;

    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCachedData<T>(
  key: string,
  data: T,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.setEx(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    console.error('Redis set error:', error);
  }
}
