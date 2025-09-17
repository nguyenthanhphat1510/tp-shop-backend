// src/app.module.ts - TEST VERSION
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// ❌ COMMENT TẤT CẢ MODULES KHÁC ĐỂ TEST
// import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true, 
      envFilePath: '.env' 
    }),
    // ❌ Comment database để test app cơ bản
    // DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
