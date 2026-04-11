import { IsString, IsEnum, IsOptional, IsDateString, IsArray } from 'class-validator';

export class CreateResponseDto {
  @IsOptional()
  @IsEnum(['YES', 'NO', 'PARTIALLY'])
  acknowledgement?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  currentStatus?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @IsOptional()
  @IsArray()
  evidence?: string[];

  @IsOptional()
  @IsDateString()
  completionDate?: string;
}
