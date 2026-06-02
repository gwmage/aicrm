
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Anthropic SDK 모킹 ──────────────────────────────────────
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

// ─── PrismaService 모킹 ───────────────────────────────────────
const mockPrisma = {
  customer: {
    findUnique: jest.fn(),
  },
};

const mockCustomer = {
  id: 1,
  name: '홍길동',
  company: '테크코리아',
  title: 'CTO',
  email: 'hong@techkorea.com',
  memo: '엔터프라이즈 라이선스 관심',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeTextResponse = (json: object) => ({
  content: [{ type: 'text', text: JSON.stringify(json) }],
});

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  // ─── generateDraft() ─────────────────────────────────────────
  describe('generateDraft()', () => {
    it('고객 정보를 기반으로 이메일 초안을 생성한다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockCreate.mockResolvedValue(
        makeTextResponse({
          subject: '[테크코리아 홍길동님] 엔터프라이즈 라이선스 안내',
          body: '안녕하세요 홍길동 이사님.',
        }),
      );

      const result = await service.generateDraft({ customerId: 1 });

      expect(mockPrisma.customer.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-6',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
      expect(result.subject).toContain('홍길동');
      expect(result.body).toBeTruthy();
    });

    it('존재하지 않는 고객 ID이면 NotFoundException을 던진다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.generateDraft({ customerId: 999 })).rejects.toThrow(NotFoundException);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('AI가 JSON이 아닌 응답을 반환하면 BadRequestException을 던진다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'JSON이 아닌 응답입니다.' }],
      });

      await expect(service.generateDraft({ customerId: 1 })).rejects.toThrow(BadRequestException);
    });

    it('additionalContext를 프롬프트에 포함한다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockCreate.mockResolvedValue(
        makeTextResponse({ subject: '초대', body: '행사 초대합니다.' }),
      );

      await service.generateDraft({
        customerId: 1,
        additionalContext: '신제품 발표회 초대',
      });

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('신제품 발표회 초대');
    });

    it('고객의 memo가 없어도 정상 동작한다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({ ...mockCustomer, memo: null });
      mockCreate.mockResolvedValue(
        makeTextResponse({ subject: '안녕하세요', body: '메일 본문' }),
      );

      const result = await service.generateDraft({ customerId: 1 });

      expect(result.subject).toBeTruthy();
    });
  });

  // ─── changeTone() ────────────────────────────────────────────
  describe('changeTone()', () => {
    it('formal 말투로 변환한다', async () => {
      mockCreate.mockResolvedValue(
        makeTextResponse({
          subject: '귀하를 초대하게 되어 영광입니다',
          body: '안녕하십니까. 정중히 초대드립니다.',
        }),
      );

      const result = await service.changeTone({
        subject: '초대합니다',
        body: '오세요.',
        tone: 'formal' as any,
      });

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('격식 있는 비즈니스체');
      expect(result.subject).toBeTruthy();
      expect(result.body).toBeTruthy();
    });

    it('casual 말투로 변환한다', async () => {
      mockCreate.mockResolvedValue(
        makeTextResponse({
          subject: '같이 만나요!',
          body: '안녕하세요~ 편하게 오세요!',
        }),
      );

      const result = await service.changeTone({
        subject: '미팅 요청',
        body: '만남을 요청드립니다.',
        tone: 'casual' as any,
      });

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('부드러운 대화체');
      expect(result.subject).toBeTruthy();
    });

    it('원본 subject/body를 프롬프트에 포함한다', async () => {
      mockCreate.mockResolvedValue(makeTextResponse({ subject: 'new', body: 'new body' }));

      await service.changeTone({
        subject: '원본 제목',
        body: '원본 본문 내용입니다.',
        tone: 'formal' as any,
      });

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('원본 제목');
      expect(calledPrompt).toContain('원본 본문 내용입니다.');
    });
  });

  // ─── translate() ─────────────────────────────────────────────
  describe('translate()', () => {
    it('영어로 번역한다', async () => {
      mockCreate.mockResolvedValue(
        makeTextResponse({
          subject: 'Invitation to our event',
          body: 'Dear Mr. Hong, we would like to invite you.',
        }),
      );

      const result = await service.translate({
        subject: '행사 초대',
        body: '안녕하세요 홍길동님. 초대합니다.',
        targetLanguage: 'English',
      });

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('English');
      expect(result.subject).toBe('Invitation to our event');
    });

    it('일본어로 번역한다', async () => {
      mockCreate.mockResolvedValue(
        makeTextResponse({
          subject: 'イベントへのご招待',
          body: 'こんにちは。ご招待申し上げます。',
        }),
      );

      const result = await service.translate({
        subject: '행사 초대',
        body: '안녕하세요.',
        targetLanguage: 'Japanese',
      });

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('Japanese');
      expect(result.subject).toBeTruthy();
    });

    it('AI가 JSON이 아닌 응답을 반환하면 BadRequestException을 던진다', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'invalid response' }],
      });

      await expect(
        service.translate({ subject: '제목', body: '본문', targetLanguage: 'English' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
