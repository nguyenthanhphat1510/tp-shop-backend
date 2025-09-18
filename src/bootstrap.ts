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

    await app.init();
    const expressApp = app.getHttpAdapter().getInstance();
    
    // ✅ Luôn thêm debug middleware trong production
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        console.log('✅ Adding Vercel debug middleware...');
        expressApp.use((req: any, res: any, next: any) => {
            console.log(`📍 NestJS received: ${req.method} ${req.url}`);
            next();
        });
    } else {
        console.log('❌ Vercel: No global prefix');
    }
    
    console.log('✅ NestJS server initialized');
    return expressApp;
}
