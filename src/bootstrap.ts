// src/bootstrap.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

export async function createNestServer() {
    console.log('🚀 Creating NestJS server...');
    const app = await NestFactory.create(AppModule);

    const config = app.get(ConfigService);
    app.enableCors({
        origin: config.get('CLIENT_URL') || true,
        credentials: true,
    });

    // ✅ KHÔNG set global prefix trên Vercel
    if (!process.env.VERCEL) {
        app.setGlobalPrefix('api');
        console.log('✅ Local: Global prefix "api" set');
    } else {
        console.log('✅ Vercel: No global prefix');
    }

    await app.init();
    console.log('✅ NestJS server initialized');
    
    const expressApp = app.getHttpAdapter().getInstance();
    
    // ✅ Debug middleware cho Vercel
    if (process.env.VERCEL) {
        expressApp.use((req: any, res: any, next: any) => {
            console.log(`📍 NestJS received: ${req.method} ${req.url}`);
            next();
        });
    }
    
    return expressApp;
}
