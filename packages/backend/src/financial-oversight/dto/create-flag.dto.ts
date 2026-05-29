import { IsString, IsEnum, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { FlagSeverity, FlagCategory } from '@prisma/client';

export class CreateFlagDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsEnum(FlagSeverity)
  severity: FlagSeverity;

  @IsEnum(FlagCategory)
  category: FlagCategory;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
