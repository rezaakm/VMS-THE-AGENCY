import { IsString, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

enum POStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

class POItemDto {
  @ApiProperty({ example: 'ITEM001' })
  @IsString()
  itemNumber: string;

  @ApiProperty({ example: 'Laptop Computer' })
  @IsString()
  description: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 999.99 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ example: 0, default: 0 })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: 8.5, default: 0 })
  @IsNumber()
  @IsOptional()
  taxRate?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  vendorId: string;

  @ApiProperty({ enum: POStatus, default: 'DRAFT' })
  @IsEnum(POStatus)
  @IsOptional()
  status?: POStatus;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  requiredDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @ApiProperty({ example: 50, default: 0 })
  @IsNumber()
  @IsOptional()
  shippingCost?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @ApiProperty({ type: [POItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POItemDto)
  items: POItemDto[];
}

