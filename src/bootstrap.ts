// src/bootstrap.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';                  // ✅ Thay đổi thành default import
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';

export async function createNestServer() {
    const server = express();                   
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
    return server;                              
}
