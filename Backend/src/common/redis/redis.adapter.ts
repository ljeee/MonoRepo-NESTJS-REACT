import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
    
    pubClient.on('error', (err) => {
        console.error('Redis Adapter PubClient Error:', err);
    });

    const subClient = pubClient.duplicate();
    subClient.on('error', (err) => {
        console.error('Redis Adapter SubClient Error:', err);
    });

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const allowedOrigins = process.env.CORS_ORIGINS
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const originsToAllow = allowedOrigins && allowedOrigins.length > 0 
      ? allowedOrigins 
      : ['tauri://localhost', 'http://localhost:1420', 'http://localhost:8081'];

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: originsToAllow,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      }
    });

    if (this.adapterConstructor) {
        server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
