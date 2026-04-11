import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateProcessDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  owner: string;

  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'])
  frequency: string;

  @IsOptional()
  @IsEnum(['NOT_STARTED', 'IN_DEVELOPMENT', 'ACTIVE', 'NEEDS_UPDATE'])
  status?: string;

  @IsOptional()
  @IsString()
  templateUrl?: string;

  @IsOptional()
  @IsDateString()
  nextDue?: string;

  @IsOptional()
  @IsBoolean()
  trainingRequired?: boolean;
}
