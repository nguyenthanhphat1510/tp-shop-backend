// src/main.ts
import 'reflect-metadata';
import { createNestServer } from './bootstrap';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const server = await createNestServer();
  const port = process.env.PORT ?? 3000;
  server.listen(port, () => {
    console.log(`🚀 Local server: http://localhost:${port}`);
  });
}
bootstrap();
  