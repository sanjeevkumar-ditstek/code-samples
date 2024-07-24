import { Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { REDIS_PASSWORD, REDIS_URL, SOCKET_PREFIX } from 'src/utils/env.config';
import { Server } from 'socket.io';
@Injectable()
export class SocketService {
  private readonly redisClient: Redis.Redis;
  constructor() {
    this.redisClient = new Redis.Redis({
      host: REDIS_URL,
      port: 6379,
      password: REDIS_PASSWORD,
    });
  }

  /**
   * Binds id with socket id
   * @param id
   * @param socketId
   */
  public async bindIdWithSocketId(id: string, socketId: string): Promise<void> {
    const key = `${SOCKET_PREFIX}/${id}`;
    await this.redisClient.lpush(key, socketId);
  }

  /**
   * Gets socket ids by id
   * @param id
   * @returns socket ids by id
   */
  public async getSocketIdsById(id: string): Promise<string[]> {
    const key = `${SOCKET_PREFIX}/${id}`;
    return await this.redisClient.lrange(key, 0, -1);
  }

  /**
   * Unbinds id with socket id
   * @param socketId
   */
  public async unbindIdWithSocketId(
    userId: string,
    socketId: string,
  ): Promise<void> {
    const key = `${SOCKET_PREFIX}/${userId}`;
    const socketIds = await this.redisClient.lrange(key, 0, -1);

    if (socketIds.includes(socketId)) {
      await this.redisClient.lrem(key, 1, socketId);
      const remainingSocketIds = await this.redisClient.lrange(key, 0, -1);

      if (remainingSocketIds?.length === 0) {
        await this.redisClient.del(key);
      }
    }
  }

  /**
   * Checks and remove dead socket ids
   * @param socketServer
   * @returns and remove dead socket ids
   */
  public async checkAndRemoveDeadSocketIds(
    socketServer: Server,
  ): Promise<void> {
    const keys = await this.redisClient.keys(`${SOCKET_PREFIX}/*`);
    for (const key of keys) {
      const userId = key.split('/')[1];
      const socketIds = await this.redisClient.lrange(key, 0, -1);

      for (const socketId of socketIds) {
        const socket = socketServer.sockets.sockets.get(socketId);
        if (!socket || !socket.connected) {
          await this.unbindIdWithSocketId(userId, socketId);
        }
      }
    }
  }

}