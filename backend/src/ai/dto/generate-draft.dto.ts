import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateDraftDto {
  @IsNumber()
  customerId: number;

  @IsOptional()
  @IsString()
  additionalContext?: string;
}
