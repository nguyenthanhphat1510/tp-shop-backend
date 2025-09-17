// api/index.ts
import 'reflect-metadata';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    if (!app) {
      console.log('🔄 Creating NestJS app for Vercel...');
      app = await NestFactory.create(AppModule, {
        logger: false, // Tắt logging để tránh spam
      });
      
      app.setGlobalPrefix('api');
      app.enableCors({
        origin: '*',
        credentials: true,
      });
      
      await app.init();
      console.log('✅ NestJS app created successfully');
    }

    const server = app.getHttpAdapter().getInstance();
    return server(req, res);
    
  } catch (error) {
    console.error('❌ Vercel handler error:', error);
    
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}