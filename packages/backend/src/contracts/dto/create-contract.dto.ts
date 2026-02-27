import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum ContractStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export class CreateContractDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  vendorId: string;

  @ApiProperty({ example: 'IT Services Agreement' })
  @IsString()
  title: string;

  @ApiProperty({ enum: ContractStatus, default: 'DRAFT' })
  @IsEnum(ContractStatus)
  @IsOptional()
  status?: ContractStatus;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  signedDate?: string;

  @ApiProperty({ example: 100000, required: false })
  @IsNumber()
  @IsOptional()
  contractValue?: number;

  @ApiProperty({ example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  terms?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;

  @ApiProperty({ example: 12, required: false })
  @IsNumber()
  @IsOptional()
  renewalPeriod?: number;
}

