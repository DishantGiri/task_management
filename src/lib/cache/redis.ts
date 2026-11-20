import Redis from "ioredis";

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as {
  redisClient: Redis | null | undefined;
  redisAvailable: boolean | undefined;
  redisLastAttempt: number | undefined;
  l1Cache: Map<string, MemoryEntry> | undefined;
};

const l1Cache = globalForCache.l1Cache ?? new Map<string, MemoryEntry>();
globalForCache.l1Cache = l1Cache;

function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  const now = Date.now();
  if (
    globalForCache.redisAvailable === false &&
    globalForCache.redisLastAttempt &&
    now - globalForCache.redisLastAttempt < 30_000
  ) {
    return null;
  }

  if (globalForCache.redisClient) {
    return globalForCache.redisClient;
  }

  try {
    globalForCache.redisLastAttempt = now;
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 350,
      commandTimeout: 350,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 1) {
          globalForCache.redisAvailable = false;
          return null;
        }
        return 200;
      },
    });

    client.on("ready", () => {
      globalForCache.redisAvailable = true;
    });

    client.on("error", () => {
      globalForCache.redisAvailable = false;
    });

    globalForCache.redisClient = client;
    return client;
  } catch {
    globalForCache.redisAvailable = false;
    return null;
  }
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();

  // 1. Ultra-fast L1 memory hit (<0.05ms)
  const memHit = l1Cache.get(key);
  if (memHit && memHit.expiresAt > now) {
    try {
      return JSON.parse(memHit.value) as T;
    } catch {
      l1Cache.delete(key);
    }
  }

  // 2. Redis L2 cache check
  const redis = getRedisClient();
  if (redis && globalForCache.redisAvailable !== false) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        l1Cache.set(key, {
          value: cached,
          expiresAt: now + Math.min(ttlSeconds, 15) * 1000,
        });
        return JSON.parse(cached) as T;
      }
    } catch {
      globalForCache.redisAvailable = false;
    }
  }

  // 3. Cache miss -> fetch from MySQL and populate L1 + Redis asynchronously
  const fresh = await fetcher();
  try {
    const serialized = JSON.stringify(fresh);
    l1Cache.set(key, {
      value: serialized,
      expiresAt: now + ttlSeconds * 1000,
    });

    if (redis && globalForCache.redisAvailable !== false) {
      redis.set(key, serialized, "EX", ttlSeconds).catch(() => {
        globalForCache.redisAvailable = false;
      });
    }
  } catch {
    // Ignore serialization errors
  }

  return fresh;
}

export async function invalidateCachePrefix(prefix: string): Promise<void> {
  for (const k of l1Cache.keys()) {
    if (k.startsWith(prefix)) {
      l1Cache.delete(k);
    }
  }

  const redis = getRedisClient();
  if (redis && globalForCache.redisAvailable !== false) {
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      globalForCache.redisAvailable = false;
    }
  }
}

export async function invalidateWorkspaceCache(): Promise<void> {
  l1Cache.clear();
  const redis = getRedisClient();
  if (redis && globalForCache.redisAvailable !== false) {
    try {
      const keys = await redis.keys("meridian:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      globalForCache.redisAvailable = false;
    }
  }
}

export async function invalidatePersonalTasksCache(
  userId: string
): Promise<void> {
  await invalidateCachePrefix(`meridian:personal:${userId}`);
}
