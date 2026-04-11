import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GradeResponseDto {
  @IsEnum(['ADEQUATE', 'PARTIAL', 'INADEQUATE'])
  grade: string;

  @IsOptional()
  @IsString()
  reviewerNotes?: string;
}
