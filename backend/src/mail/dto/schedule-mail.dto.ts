import { IsDateString, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ScheduleMailDto {
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @IsEmail()
  @IsNotEmpty()
  toEmail: string;

  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string; // ISO 8601 형식 예: "2024-12-25T09:00:00.000Z"
}
