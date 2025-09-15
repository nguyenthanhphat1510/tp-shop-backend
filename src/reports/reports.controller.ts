import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

class RevenueQueryDto {
    @IsIn(['day', 'week', 'month', 'year'])
    range: 'day' | 'week' | 'month' | 'year';

    @IsOptional() @IsISO8601() from?: string; // YYYY-MM-DD
    @IsOptional() @IsISO8601() to?: string;   // YYYY-MM-DD
}

class ProductShareQueryDto {
    @IsOptional() @IsISO8601() from?: string;
    @IsOptional() @IsISO8601() to?: string;
}

@Controller('reports')
export class ReportsController {
    constructor(private readonly reports: ReportsService) { }

    @Get('revenue')
    revenue(@Query() q: RevenueQueryDto) {
        const { range, from, to } = q;
        return this.reports.revenue(range, from, to);
    }

    @Get('product-share')
    productShare(@Query() q: ProductShareQueryDto) {
        const { from, to } = q;
        return this.reports.productShare(from, to);
    }
}
