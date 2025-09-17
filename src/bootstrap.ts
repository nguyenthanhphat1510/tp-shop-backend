// src/bootstrap.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';                // ✅ dùng default import khi bật esModuleInterop
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';

export async function createNestServer() {
  const server = express();                   // ✅ callable ok
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
