// api/index.ts
import 'reflect-metadata';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!app) {
      app = await NestFactory.create(AppModule, {
        logger: false,
      });
      app.setGlobalPrefix('api');
      app.enableCors({
        origin: '*',
        credentials: true,
      });
      await app.init();
    }

    const server = app.getHttpAdapter().getInstance();
    return server(req, res);
  } catch (error) {
    console.error('API Handler Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}