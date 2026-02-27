import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  BUYER = 'BUYER',
  VIEWER = 'VIEWER',
}

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ enum: UserRole, default: 'BUYER' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

