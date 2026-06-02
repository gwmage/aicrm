import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ToneType {
  FORMAL = 'formal',
  CASUAL = 'casual',
}

export class ChangeToneDto {
  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsEnum(ToneType)
  tone: ToneType;
}
