import { IsNumber, IsOptional, IsString, IsArray, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class BidItemDto {
  @ApiProperty({ description: 'RFQ Item ID' })
  @IsString()
  rfqItemId: string;

  @ApiProperty({ example: 150.5 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubmitBidDto {
  @ApiProperty({ type: [BidItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BidItemDto)
  items: BidItemDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, example: 30 })
  @IsInt()
  @IsOptional()
  validityDays?: number;
}
