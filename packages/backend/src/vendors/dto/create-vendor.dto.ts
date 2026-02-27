import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  BLACKLISTED = 'BLACKLISTED',
}

export class CreateVendorDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'https://acme.com', required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ example: '123-45-6789', required: false })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiProperty({ enum: VendorStatus, default: 'PENDING' })
  @IsEnum(VendorStatus)
  @IsOptional()
  status?: VendorStatus;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'NY' })
  @IsString()
  state: string;

  @ApiProperty({ example: 'USA' })
  @IsString()
  country: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  postalCode: string;

  @ApiProperty({ example: 'Technology' })
  @IsString()
  industry: string;

  @ApiProperty({ example: 'IT Services' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'Leading IT services provider', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2020-01-01', required: false })
  @IsDateString()
  @IsOptional()
  registrationDate?: string;

  @ApiProperty({ example: 'Net 30', required: false })
  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @ApiProperty({ example: 50000, required: false })
  @IsNumber()
  @IsOptional()
  creditLimit?: number;

  @ApiProperty({ example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;
}

