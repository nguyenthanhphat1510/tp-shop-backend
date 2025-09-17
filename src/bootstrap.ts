// src/bootstrap.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

export async function createNestServer() {
    // ✅ Để NestJS tự tạo Express instance
    const app = await NestFactory.create(AppModule);

    const config = app.get(ConfigService);
    app.enableCors({
        origin: config.get('CLIENT_URL') || true,
        credentials: true,
    });

    if (!process.env.VERCEL) {
        app.setGlobalPrefix('api');
    }

    await app.init();
    
    // ✅ Trả về Express instance từ HTTP adapter
    return app.getHttpAdapter().getInstance();
}
