// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ ENABLE CORS cho development và production
  app.enableCors({
    origin: [
      'http://localhost:3000',    // Backend URL (nếu cần)
      'http://localhost:3001',    // ✅ Frontend development URL
      'http://localhost:5173',    // Vite default port
      'http://localhost:3002',    // Backup port
      'https://tp-shop-frontend.vercel.app', // Production URL
      'https://*.vercel.app',     // All Vercel deployments
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Origin', 
      'X-Requested-With',
      'Accept'
    ],
    credentials: true, // Cho phép cookies/credentials
  });

  // ✅ Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Backend API running on http://localhost:${port}`);
  console.log(`🌐 CORS enabled for localhost:3001`);
}

bootstrap();
