import { Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { REDIS_PASSWORD, REDIS_URL } from 'src/utils/env.config';

@Injectable()
export class RedisService {
    private readonly redisClient: Redis.Redis;

    constructor() {
        this.redisClient = new Redis.Redis({
            host: REDIS_URL,
            port: 6379,
            password: REDIS_PASSWORD,
        });
    }

    /**
     * Sets a value in Redis under the specified key.
     *
     * @param key The key under which the value is stored.
     * @param value The value to store (will be JSON-stringified).
     */
    async setValue(key: string, value: any): Promise<void> {
        await this.redisClient.set(key, JSON.stringify(value));
    }

    /**
     * Retrieves a value from Redis for the given key.
     *
     * @param key The key whose value is to be retrieved.
     * @returns The retrieved value, parsed from JSON; returns null if the key doesn't exist.
     */
    async getValue(key: string): Promise<string | null> {
        const value = await this.redisClient.get(key);
        return value ? JSON.parse(value) : null;
    }

    /**
     * Deletes a value from Redis associated with the specified key.
     *
     * @param key The key whose value is to be deleted.
     */
    async deleteValue(key: string): Promise<void> {
        await this.redisClient.del(key);
    }
}