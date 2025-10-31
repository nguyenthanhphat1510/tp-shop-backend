// src/products/dto/create-product-with-variants.dto.ts
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class CreateProductWithVariantsDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
    name!: string;

    @IsString()
    @IsNotEmpty({ message: 'Mô tả không được để trống' })
    description!: string;

    @IsString()
    @IsNotEmpty({ message: 'ID danh mục không được để trống' })
    categoryId!: string;

    @IsString()
    @IsNotEmpty({ message: 'ID danh mục con không được để trống' })
    subcategoryId!: string;

    
    // ✅ FIX: BỎ @Type() decorator để không override Transform result
    @Transform(({ value }) => {
        console.log('🔄 === TRANSFORM VARIANTS DEBUG ===');
        console.log('📋 Input type:', typeof value);
        console.log('📋 Input value preview:', typeof value === 'string' ? value.substring(0, 100) : value);
        console.log('📋 Is array:', Array.isArray(value));
        
        try {
            // Nếu đã là array, return luôn
            if (Array.isArray(value)) {
                console.log('✅ Already array, items:', value.length);
                return value;
            }

            // Nếu là string JSON, parse nó
            if (typeof value === 'string') {
                console.log('🔄 Parsing JSON string...');
                
                const cleanedValue = value
                    .trim()
                    .replace(/\n/g, '')
                    .replace(/\r/g, '')
                    .replace(/,\s*]/g, ']')
                    .replace(/,\s*}/g, '}');
                
                const parsed = JSON.parse(cleanedValue);
                console.log('✅ Parsed successfully, length:', Array.isArray(parsed) ? parsed.length : 1);
                
                const result = Array.isArray(parsed) ? parsed : [parsed];
                
                // Log first item to verify
                if (result[0]) {
                    console.log('📦 First item sample:', {
                        storage: result[0].storage,
                        color: result[0].color,
                        price: result[0].price,
                        stock: result[0].stock
                    });
                }
                
                return result;
            }

            console.log('❌ Unsupported type:', typeof value);
            return value;
            
        } catch (error) {
            console.error('❌ Transform failed:', error.message);
            throw new Error(`Invalid variants format: ${error.message}`);
        } finally {
            console.log('🔄 === TRANSFORM VARIANTS END ===');
        }
    })
    // ✅ BỎ @Type(() => CreateVariantDto) - Đây là nguyên nhân gây lỗi
    @IsArray({ message: 'Variants must be an array' })
    @ArrayMinSize(1, { message: 'Phải có ít nhất 1 biến thể' })
    // ✅ BỎ @ValidateNested vì không có @Type
    variants!: any[]; // ✅ Dùng any[] thay vì CreateVariantDto[]
}
