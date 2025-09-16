// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mongodb',
        url: configService.get('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        synchronize: false, // ✅ MUST be false in production
        logging: false,     // ✅ Disable logs for performance
        entities: [__dirname + '/../**/*.entity{.ts,.js}'], // ✅ Correct path
        autoLoadEntities: true,
        // ✅ Serverless optimizations
        connectTimeout: 30000,
        socketTimeout: 30000,
      }),
    }),
  ],
})
export class DatabaseModule {}
