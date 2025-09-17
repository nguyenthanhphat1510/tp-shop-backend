// src/bootstrap.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { ConfigService } from '@nestjs/config';

export async function createNestServer() {
    const server = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

    const config = app.get(ConfigService);

    // CORS (frontend khác domain thì set origin đúng)
    app.enableCors({
        origin: config.get('CLIENT_URL') || true,
        credentials: true,
    });

    // ❗️ĐỪNG đặt global prefix 'api' trong Vercel
    // Vì tất cả request đã đi qua /api/index.ts. Nếu đặt nữa sẽ thành /api/api/...
    if (!process.env.VERCEL) {
        // chạy local mới cần prefix cho gọn
        app.setGlobalPrefix('api');
    }

    await app.init();
    return server; // Express instance đã gắn Nest
}
