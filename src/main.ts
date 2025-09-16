import 'reflect-metadata'; // ✅ Thêm dòng này ở đầu tiên
import { NestFactory } from '@nestjs/core';

// Trong main.ts
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    // Thêm tiền tố /api cho tất cả các routes
    const configService = app.get(ConfigService);
  console.log('JWT_SECRET:', configService.get('JWT_SECRET')); // Kiểm tra giá trị
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}

// ✅ Local development
if (process.env.NODE_ENV !== 'production') {
  bootstrap();
}

// ✅ Vercel serverless export
export default async (req: any, res: any) => {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api');
  app.enableCors();
  await app.init();
  
  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
};
