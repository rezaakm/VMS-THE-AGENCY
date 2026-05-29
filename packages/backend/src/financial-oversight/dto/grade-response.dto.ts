import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ResponseGrade } from '@prisma/client';

export class GradeResponseDto {
  @IsEnum(ResponseGrade)
  grade: ResponseGrade;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  gradeNotes?: string;
}
