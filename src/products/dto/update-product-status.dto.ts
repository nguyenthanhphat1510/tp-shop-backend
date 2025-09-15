import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProductStatusDto {
  @IsBoolean({ message: 'isActive phải là boolean (true/false)' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return true;
  })
  isActive?: boolean;
}