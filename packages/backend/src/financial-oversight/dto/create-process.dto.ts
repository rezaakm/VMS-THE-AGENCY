import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateProcessDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sopLink?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
