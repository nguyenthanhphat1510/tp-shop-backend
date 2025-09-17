// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mongodb',
        url: config.get<string>('MONGODB_URI')!, // ví dụ: mongodb+srv://...
        // Với Atlas thường cần tls/ssl:
        ssl: true, // hoặc tls: true
        useUnifiedTopology: true as any, // (tùy driver, có thể bỏ nếu cảnh báo)
        // QUAN TRỌNG: đừng để true trên production
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: true,
        // Dùng path dựa theo __dirname để chạy được cả .ts (dev) và .js (prod)
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        autoLoadEntities: true,

        // Một số extra cho môi trường serverless (tùy driver có hỗ trợ):
        keepConnectionAlive: true,
        retryAttempts: 3,
        // extra: { maxIdleTimeMS: 60000 }, // uncomment nếu driver hỗ trợ
      }),
    }),
  ],
})
export class DatabaseModule { }
