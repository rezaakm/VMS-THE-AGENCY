import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  acknowledge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rootCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  currentStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  actionPlan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  evidence?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  completionDate?: string;
}
