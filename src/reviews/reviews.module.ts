import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Review } from './entities/review.entity';
import { Product } from '../products/entities/product.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Review, Product])
    ],
    controllers: [ReviewsController],
    providers: [ReviewsService],
    exports: [ReviewsService]
})
export class ReviewsModule { }