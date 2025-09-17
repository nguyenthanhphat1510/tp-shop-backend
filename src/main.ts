import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    console.log('JWT_SECRET:', configService.get('JWT_SECRET'));
    
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    });
    
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  } catch (error) {
    console.error('❌ Error starting application:', error);
    process.exit(1);
  }
}

// Chỉ chạy khi không phải production
bootstrap();
