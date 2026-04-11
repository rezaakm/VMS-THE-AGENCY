import { IsString, IsEnum, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateChecklistItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'])
  frequency: string;

  @IsString()
  owner: string;

  @IsOptional()
  @IsInt()
  dueDay?: number;

  @IsEnum(['BUDGET', 'REVENUE', 'COSTS', 'AR', 'STAFF', 'EXPENSES', 'RECONCILIATION', 'COMPLIANCE', 'PROCESSES'])
  category: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
