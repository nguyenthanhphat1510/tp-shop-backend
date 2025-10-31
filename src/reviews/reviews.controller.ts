import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) { }

    @Post('products/:productId')
    // @UseGuards(JwtAuthGuard)
    async createReview(
        @Param('productId') productId: string,
        @Body() createReviewDto: CreateReviewDto,
        // @Req() req: any
    ) {
        // return this.reviewsService.createReview(req.user.userId, productId, createReviewDto);
        // Tạm thời hardcode userId để test
        const userId = new ObjectId("507f1f77bcf86cd799439011");
        return this.reviewsService.createReview(userId, productId, createReviewDto);
    }

    @Get('products/:productId')
    async getProductReviews(
        @Param('productId') productId: string,
        @Query() query: ReviewQueryDto
    ) {
        return this.reviewsService.getProductReviews(productId, query);
    }

    @Get('products/:productId/stats')
    async getProductRatingStats(@Param('productId') productId: string) {
        return this.reviewsService.getProductRatingStats(productId);
    }

    @Delete(':reviewId')
    // @UseGuards(JwtAuthGuard)
    async deleteReview(
        @Param('reviewId') reviewId: string,
        // @Req() req: any
    ) {
        // return this.reviewsService.deleteReview(reviewId, req.user.userId);
        // Tạm thời hardcode userId để test
        const userId = new ObjectId("507f1f77bcf86cd799439011");
        return this.reviewsService.deleteReview(reviewId, userId);
    }
}