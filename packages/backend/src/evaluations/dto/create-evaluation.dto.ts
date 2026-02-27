import { IsString, IsNumber, Min, Max, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvaluationDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  vendorId: string;

  @ApiProperty({ example: 4.5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  qualityScore: number;

  @ApiProperty({ example: 4.0, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  deliveryScore: number;

  @ApiProperty({ example: 3.5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  pricingScore: number;

  @ApiProperty({ example: 5.0, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  serviceScore: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiProperty({ example: 'Q1 2024', required: false })
  @IsString()
  @IsOptional()
  period?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  evaluationDate?: string;
}

