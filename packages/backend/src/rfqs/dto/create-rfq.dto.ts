import { IsString, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class RFQItemDto {
  @ApiProperty({ example: 'Backdrop 6x3m printed fabric' })
  @IsString()
  description: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'sqm' })
  @IsString()
  unit: string;

  @ApiProperty({ required: false, example: 'Outdoor grade, UV-resistant' })
  @IsString()
  @IsOptional()
  specs?: string;
}

export class CreateRfqDto {
  @ApiProperty({ example: 'AV Equipment for Annual Gala' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, example: 'AV Equipment' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: '2026-04-30T00:00:00.000Z' })
  @IsDateString()
  deadline: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [RFQItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RFQItemDto)
  items: RFQItemDto[];

  @ApiProperty({ type: [String], description: 'Vendor IDs to invite' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  vendorIds?: string[];
}
