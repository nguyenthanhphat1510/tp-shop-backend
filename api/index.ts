// api/index.ts
import 'reflect-metadata';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('Function invoked:', req.url);
    
    if (!app) {
      console.log('Creating NestJS app...');
      app = await NestFactory.create(AppModule, {
        logger: false, // Tắt logging để tránh spam
      });
      
      app.setGlobalPrefix('api');
      app.enableCors({
        origin: '*',
        credentials: true,
      });
      
      await app.init();
      console.log('NestJS app initialized');
    }

    const server = app.getHttpAdapter().getInstance();
    return server(req, res);
    
  } catch (error) {
    console.error('API Handler Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}