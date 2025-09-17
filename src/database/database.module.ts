// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mongodb',
        url: configService.get<string>('MONGODB_URI'),
        // ❌ Xóa các option deprecated này:
        // useUnifiedTopology: true,
        // useNewUrlParser: true,
        
        // ✅ Chỉ giữ các option cần thiết:
        synchronize: false, // ⚠️ Set false cho production
        logging: false,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        ssl: configService.get<string>('NODE_ENV') === 'production',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
