import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  console.log('JWT_SECRET:', configService.get('JWT_SECRET'));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}

// Local development
if (process.env.NODE_ENV !== 'production') {
  bootstrap();
}

// ✅ Export cho Vercel serverless
let cachedApp: any = null;

export default async (req: any, res: any) => {
  try {
    if (!cachedApp) {
      cachedApp = await NestFactory.create(AppModule, {
        logger: false,
      });
      cachedApp.setGlobalPrefix('api');
      cachedApp.enableCors({
        origin: '*',
        credentials: true,
      });
      await cachedApp.init();
    }

    const server = cachedApp.getHttpAdapter().getInstance();
    return server(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
};
