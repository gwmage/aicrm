import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SendMailDto {
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
}
