import { IsString, IsInt, IsOptional, IsBoolean, IsEnum, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateChecklistItemDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsString()
  frequency: string;

  @IsInt()
  dueDay: number;

  @IsOptional()
  @IsEnum(UserRole)
  ownerRole?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
