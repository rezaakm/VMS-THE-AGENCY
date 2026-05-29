import { IsString, IsEnum, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { FlagSeverity, FlagStatus } from '@prisma/client';

export class UpdateFlagDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(FlagSeverity)
  severity?: FlagSeverity;

  @IsOptional()
  @IsEnum(FlagStatus)
  status?: FlagStatus;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
