import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateDraftDto } from './dto/generate-draft.dto';
import { ChangeToneDto, ToneType } from './dto/change-tone.dto';
import { TranslateDto } from './dto/translate.dto';

@Injectable()
export class AiService {
  private readonly apiKey = process.env.GEMINI_API_KEY || '';
  private readonly model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  constructor(private readonly prisma: PrismaService) {}

  // Gemini 호출 (응답을 JSON 텍스트로 받음)
  private async callGemini(prompt: string): Promise<string> {
    if (!this.apiKey) throw new BadRequestException('GEMINI_API_KEY가 설정되지 않았습니다.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }, // 2.5 모델의 '사고' 비활성화 → 본문 출력 보장
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`AI 호출 실패(${res.status}): ${err.slice(0, 200)}`);
    }
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private parseJson(text: string): { subject: string; body: string } {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('JSON not found');
      return JSON.parse(m[0]);
    } catch {
      throw new BadRequestException('AI 응답 파싱에 실패했습니다. 다시 시도해주세요.');
    }
  }

  // 기능 06: AI 맞춤 메일 초안 작성
  async generateDraft(dto: GenerateDraftDto): Promise<{ subject: string; body: string }> {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException(`고객을 찾을 수 없습니다: ID ${dto.customerId}`);
    }
    const memo = customer.memo || '(메모 없음)';
    const additionalContext = dto.additionalContext || '';

    const prompt = `당신은 전문 비즈니스 이메일 작성 도우미입니다.
아래 고객 정보와 메모를 바탕으로 개인화된 비즈니스 이메일 초안을 작성해주세요.

[고객 정보]
- 이름: ${customer.name}
- 회사: ${customer.company || '(미기재)'}
- 직함: ${customer.title || '(미기재)'}
- 이메일: ${customer.email}
- 메모: ${memo}
${additionalContext ? `\n[추가 맥락]\n${additionalContext}` : ''}

[작성 규칙]
1. 한국어 비즈니스 격식체로 작성하세요.
2. 고객의 메모 내용을 핵심 소재로 활용하세요.
3. 반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

{"subject": "이메일 제목", "body": "이메일 본문 내용"}`;

    return this.parseJson(await this.callGemini(prompt));
  }

  // 기능 07: 메일 말투 변경
  async changeTone(dto: ChangeToneDto): Promise<{ subject: string; body: string }> {
    const toneDescription =
      dto.tone === ToneType.FORMAL
        ? '격식 있는 비즈니스체 (정중하고 공손한 문체)'
        : '부드러운 대화체 (친근하고 편안한 문체)';

    const prompt = `당신은 이메일 문체 변환 전문가입니다.
아래 이메일의 내용(의미)은 그대로 유지하면서, 문체만 "${toneDescription}"로 변환해주세요.

[원본 이메일]
제목: ${dto.subject}
본문:
${dto.body}

[변환 규칙]
1. 내용과 정보는 변경하지 마세요.
2. 문체와 표현만 변환하세요.
3. 반드시 아래 JSON 형식으로만 응답하세요:

{"subject": "변환된 제목", "body": "변환된 본문"}`;

    return this.parseJson(await this.callGemini(prompt));
  }

  // 기능 08: 다국어 메일 번역
  async translate(dto: TranslateDto): Promise<{ subject: string; body: string }> {
    const prompt = `당신은 비즈니스 이메일 번역 전문가입니다.
아래 이메일을 "${dto.targetLanguage}"로 번역해주세요.

[원본 이메일]
제목: ${dto.subject}
본문:
${dto.body}

[번역 규칙]
1. 비즈니스 격식체 및 해당 언어의 문화적 어법에 맞게 번역하세요.
2. 원문의 의미와 내용을 정확하게 전달하세요.
3. 반드시 아래 JSON 형식으로만 응답하세요:

{"subject": "번역된 제목", "body": "번역된 본문"}`;

    return this.parseJson(await this.callGemini(prompt));
  }
}
