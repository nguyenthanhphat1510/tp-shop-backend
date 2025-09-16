// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  try {
    const server = app.getHttpAdapter().getInstance();
    return server(req, res);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
}