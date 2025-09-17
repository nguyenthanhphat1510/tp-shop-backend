import 'reflect-metadata'; // ✅ Thêm dòng này ở đầu tiên
import { NestFactory } from '@nestjs/core';

// Trong main.ts
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    // Thêm tiền tố /api cho tất cả các routes
    const configService = app.get(ConfigService);
  console.log('JWT_SECRET:', configService.get('JWT_SECRET')); // Kiểm tra giá trị
  app.setGlobalPrefix('api');
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
