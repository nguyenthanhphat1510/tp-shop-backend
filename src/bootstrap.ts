// src/bootstrap.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';            // ✅ Sử dụng namespace import
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';

export async function createNestServer() {
    const server = express();                   // ✅ Bây giờ sẽ work
    const app: INestApplication = await NestFactory.create(
        AppModule,
        new ExpressAdapter(server),
    );

    const config = app.get(ConfigService);
    app.enableCors({
        origin: config.get('CLIENT_URL') || true,
        credentials: true,
    });

    if (!process.env.VERCEL) {
        app.setGlobalPrefix('api');
    }

    await app.init();
    return server;                              // Express app (req, res) handler
}
