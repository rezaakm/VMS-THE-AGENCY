import { IsString, IsEnum, IsOptional, IsInt, IsDateString } from 'class-validator';

export class CreateFlagDto {
  @IsInt()
  flagNumber: number;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  severity: string;

  @IsEnum(['BUDGET', 'REVENUE', 'COSTS', 'AR', 'STAFF', 'EXPENSES', 'RECONCILIATION', 'COMPLIANCE', 'PROCESSES'])
  category: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
