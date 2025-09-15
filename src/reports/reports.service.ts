import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from 'src/order/entities/order.entity';
import { OrderItem } from 'src/order/entities/order-item.entity';

type Range = 'day' | 'week' | 'month' | 'year';

const TZ = 'Asia/Ho_Chi_Minh'; // +07:00

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Order) private readonly orderRepo: MongoRepository<Order>,
        @InjectRepository(OrderItem) private readonly orderItemRepo: MongoRepository<OrderItem>,
    ) { }

    // ---------- Helpers ----------
    private buildDateMatch(from?: string, to?: string) {
        const createdAt: any = {};
        if (from) createdAt.$gte = new Date(from + 'T00:00:00.000Z');
        if (to) createdAt.$lt = new Date(to + 'T23:59:59.999Z');
        return Object.keys(createdAt).length ? { createdAt } : {};
    }

    // đơn được tính doanh thu: paid hoặc đã giao (tuỳ bạn chỉnh)
    private paidStatusMatch() {
        return {
            $or: [
                { paymentStatus: PaymentStatus.PAID },
                { status: { $in: [OrderStatus.CONFIRMED, OrderStatus.SHIPPING, OrderStatus.DELIVERED] } },
            ],
            status: { $ne: OrderStatus.CANCELLED },
        };
    }

    // ---------- Revenue ----------
    async revenue(range: Range, from?: string, to?: string) {
        const match: any = {
            ...this.paidStatusMatch(),
            ...this.buildDateMatch(from, to),
        };

        // label expression per range
        let labelExpr: any;
        switch (range) {
            case 'day':
                // giờ trong ngày: 00:00 - 23:00
                labelExpr = { $dateToString: { format: '%H:00', date: '$createdAt', timezone: TZ } };
                break;
            case 'week':
                // thứ trong tuần: sẽ map 1..7 -> CN..T7
                labelExpr = { $dayOfWeek: { date: '$createdAt', timezone: TZ } }; // 1=CN ... 7=T7
                break;
            case 'month':
                // ngày trong tháng: 1..31
                labelExpr = { $dateToString: { format: '%d', date: '$createdAt', timezone: TZ } };
                break;
            case 'year':
            default:
                // tháng trong năm: 01..12
                labelExpr = { $dateToString: { format: '%m', date: '$createdAt', timezone: TZ } };
                break;
        }

        const pipeline: any[] = [
            { $match: match },
            {
                $group: {
                    _id: labelExpr,
                    amountVnd: { $sum: '$total' }, // total là VND
                    firstAt: { $min: '$createdAt' }, // để sort đúng theo thời gian
                },
            },
        ];

        // sort theo thời gian/ngữ nghĩa
        if (range === 'week') {
            // ưu tiên Thứ 2..Thứ 7..Chủ nhật
            pipeline.push({ $addFields: { sortKey: { $mod: [{ $add: ['$_id', 5] }, 7] } } }); // map 2..7,1
            pipeline.push({ $sort: { sortKey: 1 } });
        } else {
            pipeline.push({ $sort: { firstAt: 1 } });
        }

        const rows = await this.orderRepo.aggregate(pipeline).toArray();

        // map label -> name theo format frontend
        const mapWeek = (d: number) => (['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d - 1] ?? String(d));
        const mapMonth = (m: string) => `T${Number(m)}`;
        const mapMonthDay = (d: string) => String(Number(d)); // '01' -> '1'

        return rows.map((r: any) => {
            let name: string;
            switch (range) {
                case 'day': name = r._id; break; // '13:00'
                case 'week': name = mapWeek(r._id); break; // 'T2'..'CN'
                case 'month': name = mapMonthDay(r._id); break; // '1'..'31'
                case 'year': name = mapMonth(r._id); break; // 'T1'..'T12'
            }
            const doanhthu = Math.round((Number(r.amountVnd || 0) / 1_000_000) * 100) / 100; // triệu VND, 2 chữ số
            return { name, doanhthu };
        });
    }

    // ---------- Product share ----------
    async productShare(from?: string, to?: string) {
        const matchOrder: any = {
            ...this.paidStatusMatch(),
            ...this.buildDateMatch(from, to),
        };

        const pipeline: any[] = [
            // order_items -> join orders để lọc theo thời gian/trạng thái
            {
                $lookup: {
                    from: 'orders',
                    localField: 'orderId',
                    foreignField: '_id',
                    as: 'order',
                },
            },
            { $unwind: '$order' },
            {
                $match: {
                    'order.status': matchOrder.status,
                    $or: matchOrder.$or,
                    ...(matchOrder.createdAt ? { 'order.createdAt': matchOrder.createdAt } : {}),
                },
            },
            {
                $group: {
                    _id: '$productName',
                    qty: { $sum: '$quantity' },
                },
            },
            { $sort: { qty: -1 } },
            { $project: { _id: 0, name: '$_id', value: '$qty' } },
        ];

        return this.orderItemRepo.aggregate(pipeline).toArray();
    }
}
