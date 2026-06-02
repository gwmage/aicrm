import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateDraftDto } from './dto/generate-draft.dto';
import { ChangeToneDto } from './dto/change-tone.dto';
import { TranslateDto } from './dto/translate.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // POST /api/ai/draft - AI 메일 초안 생성 (기능 06)
  @Post('draft')
  @HttpCode(HttpStatus.OK)
  generateDraft(@Body() dto: GenerateDraftDto) {
    return this.aiService.generateDraft(dto);
  }

  // POST /api/ai/tone - 말투 변경 (기능 07)
  @Post('tone')
  @HttpCode(HttpStatus.OK)
  changeTone(@Body() dto: ChangeToneDto) {
    return this.aiService.changeTone(dto);
  }

  // POST /api/ai/translate - 다국어 번역 (기능 08)
  @Post('translate')
  @HttpCode(HttpStatus.OK)
  translate(@Body() dto: TranslateDto) {
    return this.aiService.translate(dto);
  }
}
