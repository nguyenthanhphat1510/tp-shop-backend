import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Review } from './entities/review.entity';
import { Product } from '../products/entities/product.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';

@Injectable()
export class ReviewsService {
    constructor(
        @InjectRepository(Review)
        private reviewRepository: Repository<Review>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
    ) { }

    // ✅ TẠO ĐÁNH GIÁ (Sửa lại)
    async createReview(userId: ObjectId, productId: string, createReviewDto: CreateReviewDto): Promise<Review> {
        const { variant_id, order_id, rating, comment } = createReviewDto;

        // Kiểm tra sản phẩm có tồn tại không
        const product = await this.productRepository.findOne({
            where: { _id: new ObjectId(productId) }
        });

        if (!product) {
            throw new NotFoundException('Không tìm thấy sản phẩm');
        }

        // ✅ KIỂM TRA USER ĐÃ MUA SẢN PHẨM TRONG ORDER NÀY CHƯA
        const hasPurchased = await this.checkUserPurchaseInOrder(
            userId, 
            new ObjectId(productId), 
            new ObjectId(variant_id), 
            new ObjectId(order_id)
        );

        if (!hasPurchased) {
            throw new BadRequestException('Bạn chỉ có thể đánh giá sản phẩm đã mua trong đơn hàng này');
        }

        // ✅ KIỂM TRA ĐÃ ĐÁNH GIÁ SẢN PHẨM TRONG ORDER NÀY CHƯA
        const existingReview = await this.reviewRepository.findOne({
            where: {
                user_id: userId,
                product_id: new ObjectId(productId),
                order_id: new ObjectId(order_id) // ✅ Kiểm tra theo cả order_id
            }
        });

        if (existingReview) {
            throw new BadRequestException('Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi');
        }

        const review = this.reviewRepository.create({
            user_id: userId,
            product_id: new ObjectId(productId),
            variant_id: new ObjectId(variant_id),
            order_id: new ObjectId(order_id), // ✅ Thêm order_id
            rating,
            comment
        });

        const savedReview = await this.reviewRepository.save(review);

        // Cập nhật rating trung bình cho sản phẩm
        await this.updateProductRating(new ObjectId(productId));

        return savedReview;
    }

    // ✅ KIỂM TRA USER ĐÃ MUA SẢN PHẨM TRONG ORDER CHƯA
    private async checkUserPurchaseInOrder(
        userId: ObjectId, 
        productId: ObjectId, 
        variantId: ObjectId | null, 
        orderId: ObjectId
    ): Promise<boolean> {
        // TODO: Implement logic kiểm tra user đã mua sản phẩm này trong order này chưa
        // Cần truy vấn bảng orders và order_items
        // 
        // Ví dụ logic:
        // 1. Kiểm tra order có thuộc về user không
        // 2. Kiểm tra order có chứa variant này không
        // 3. Kiểm tra order đã hoàn thành chưa (status = 'completed')
    
        // const order = await this.orderRepository.findOne({
        //     where: { 
        //         _id: orderId, 
        //         user_id: userId,
        //         status: 'completed' 
        //     }
        // });
    
        // if (!order) return false;
    
        // const orderItem = await this.orderItemRepository.findOne({
        //     where: {
        //         order_id: orderId,
        //         variant_id: variantId
        //     }
        // });
    
        // return !!orderItem;

        // Tạm thời return true để test
        return true;
    }

    // ✅ LẤY DANH SÁCH ĐÁNH GIÁ
    async getProductReviews(productId: string, query: ReviewQueryDto) {
        const { page = 1, limit = 10, rating } = query;
        const skip = (page - 1) * limit;

        const whereCondition: any = {
            product_id: new ObjectId(productId)
        };

        if (rating) {
            whereCondition.rating = rating;
        }

        const [reviews, total] = await this.reviewRepository.findAndCount({
            where: whereCondition,
            order: { created_at: -1 }, // Mới nhất trước
            skip,
            take: limit
        });

        return {
            reviews,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    // ✅ CẬP NHẬT RATING TRUNG BÌNH
    private async updateProductRating(productId: ObjectId) {
        const reviews = await this.reviewRepository.find({
            where: { product_id: productId }
        });

        if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            const avgRating = Math.round((totalRating / reviews.length) * 10) / 10;

            await this.productRepository.update(
                { _id: productId },
                {
                    ratings_average: avgRating,
                    ratings_count: reviews.length
                }
            );
        }
    }

    // ✅ LẤY THỐNG KÊ RATING
    async getProductRatingStats(productId: string) {
        const reviews = await this.reviewRepository.find({
            where: { product_id: new ObjectId(productId) }
        });

        const stats = {
            total: reviews.length,
            average: 0,
            breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };

        if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            stats.average = Math.round((totalRating / reviews.length) * 10) / 10;

            reviews.forEach(review => {
                stats.breakdown[review.rating]++;
            });
        }

        return stats;
    }

    // ✅ XÓA REVIEW
    async deleteReview(reviewId: string, userId: ObjectId): Promise<void> {
        const review = await this.reviewRepository.findOne({
            where: { _id: new ObjectId(reviewId) }
        });

        if (!review) {
            throw new NotFoundException('Không tìm thấy đánh giá');
        }

        if (review.user_id.toString() !== userId.toString()) {
            throw new BadRequestException('Bạn không có quyền xóa đánh giá này');
        }

        await this.reviewRepository.delete({ _id: new ObjectId(reviewId) });

        // Cập nhật lại rating cho sản phẩm
        await this.updateProductRating(review.product_id);
    }

    // ✅ LẤY DANH SÁCH REVIEW CỦA USER CHO SẢN PHẨM
    async getUserProductReviews(userId: ObjectId, productId: string) {
        const reviews = await this.reviewRepository.find({
            where: {
                user_id: userId,
                product_id: new ObjectId(productId)
            },
            order: { created_at: -1 }
        });

        return reviews;
    }

    // ✅ KIỂM TRA USER CÓ THẂ REVIEW KHÔNG
    async canUserReviewProduct(userId: ObjectId, productId: string, orderId: string): Promise<{
        canReview: boolean;
        reason?: string;
        hasReviewed?: boolean;
    }> {
        // Kiểm tra đã mua chưa
        const hasPurchased = await this.checkUserPurchaseInOrder(
            userId, 
            new ObjectId(productId), 
            null, // variant_id có thể null trong trường hợp này
            new ObjectId(orderId)
        );

        if (!hasPurchased) {
            return {
                canReview: false,
                reason: 'Bạn chưa mua sản phẩm này trong đơn hàng này'
            };
        }

        // Kiểm tra đã review trong order này chưa
        const hasReviewed = await this.reviewRepository.findOne({
            where: {
                user_id: userId,
                product_id: new ObjectId(productId),
                order_id: new ObjectId(orderId)
            }
        });

        if (hasReviewed) {
            return {
                canReview: false,
                reason: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi',
                hasReviewed: true
            };
        }

        return { canReview: true };
    }
}