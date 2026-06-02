
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── PrismaService 모킹 ───────────────────────────────────────
const mockPrisma = {
  customer: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockCustomer = {
  id: 1,
  name: '홍길동',
  company: '테크코리아',
  title: 'CTO',
  email: 'hong@techkorea.com',
  memo: '엔터프라이즈 라이선스 관심',
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  // ─── create() ────────────────────────────────────────────────
  describe('create()', () => {
    it('새 고객을 성공적으로 등록한다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.create({
        name: '홍길동',
        email: 'hong@techkorea.com',
        company: '테크코리아',
        title: 'CTO',
      });

      expect(mockPrisma.customer.findUnique).toHaveBeenCalledWith({
        where: { email: 'hong@techkorea.com' },
      });
      expect(mockPrisma.customer.create).toHaveBeenCalled();
      expect(result).toEqual(mockCustomer);
    });

    it('중복 이메일이면 ConflictException을 던진다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);

      await expect(
        service.create({ name: '다른사람', email: 'hong@techkorea.com' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.customer.create).not.toHaveBeenCalled();
    });
  });

  // ─── findAll() ───────────────────────────────────────────────
  describe('findAll()', () => {
    it('검색어 없이 전체 고객 목록을 반환한다', async () => {
      const customers = [mockCustomer];
      mockPrisma.customer.findMany.mockResolvedValue(customers);

      const result = await service.findAll();

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(customers);
    });

    it('검색어로 이름·회사·이메일을 필터링한다', async () => {
      const customers = [mockCustomer];
      mockPrisma.customer.findMany.mockResolvedValue(customers);

      const result = await service.findAll('테크코리아');

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: '테크코리아' } },
            { company: { contains: '테크코리아' } },
            { email: { contains: '테크코리아' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(customers);
    });
  });

  // ─── findOne() ───────────────────────────────────────────────
  describe('findOne()', () => {
    it('존재하는 고객 ID로 고객을 반환한다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await service.findOne(1);
      expect(result).toEqual(mockCustomer);
    });

    it('존재하지 않는 ID면 NotFoundException을 던진다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update() ────────────────────────────────────────────────
  describe('update()', () => {
    it('고객 정보를 성공적으로 수정한다', async () => {
      const updated = { ...mockCustomer, company: 'XYZ 코퍼레이션' };
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.update.mockResolvedValue(updated);

      const result = await service.update(1, { company: 'XYZ 코퍼레이션' });

      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { company: 'XYZ 코퍼레이션' },
      });
      expect(result.company).toBe('XYZ 코퍼레이션');
    });

    it('존재하지 않는 고객이면 NotFoundException을 던진다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { company: 'test' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it('다른 고객이 사용 중인 이메일이면 ConflictException을 던진다', async () => {
      const otherCustomer = { ...mockCustomer, id: 2 };
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.customer.findFirst.mockResolvedValue(otherCustomer);

      await expect(
        service.update(1, { email: 'dup@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── remove() ────────────────────────────────────────────────
  describe('remove()', () => {
    it('고객을 성공적으로 삭제한다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.customer.delete.mockResolvedValue(mockCustomer);

      const result = await service.remove(1);

      expect(mockPrisma.customer.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockCustomer);
    });

    it('존재하지 않는 고객이면 NotFoundException을 던진다', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.customer.delete).not.toHaveBeenCalled();
    });
  });

  // ─── importFromFile() ────────────────────────────────────────
  describe('importFromFile()', () => {
    const makeXlsxBuffer = () => {
      // xlsx 라이브러리로 간단한 CSV 버퍼 생성
      const XLSX = require('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([
        ['이름', '이메일', '회사명', '직함', '메모'],
        ['김철수', 'chulsoo@test.com', '테스트컴퍼니', '과장', '메모내용'],
        ['이영희', 'younghee@test.com', null, null, null],
        ['', 'no-name@test.com', null, null, null],      // 이름 없음 → 건너뜀
        ['이름있음', 'bad-email', null, null, null],     // 이메일 형식 오류
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    };

    beforeEach(() => {
      mockPrisma.customer.upsert.mockResolvedValue({});
    });

    it('유효한 행을 upsert하고 결과 통계를 반환한다', async () => {
      const file = { buffer: makeXlsxBuffer() } as Express.Multer.File;

      const result = await service.importFromFile(file);

      expect(result.created).toBe(2);  // 유효한 2행
      expect(result.skipped).toBe(2);  // 이름 없음 + 이메일 형식 오류
      expect(result.errors).toHaveLength(2);
    });

    it('파일이 없으면 BadRequestException을 던진다', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      await expect(service.importFromFile(null as any)).rejects.toThrow(BadRequestException);
    });

    // [패치 ②] 빈 값으로 기존 고객의 메모/회사명/직함을 덮어쓰지 않는다.
    describe('빈 값 덮어쓰기 방지', () => {
      const makeRow = (row: any[]) => {
        const XLSX = require('xlsx');
        const ws = XLSX.utils.aoa_to_sheet([
          ['이름', '이메일', '회사명', '직함', '메모'],
          row,
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      };

      it('memo/company/title이 빈 행은 update 객체에서 해당 필드를 제외한다', async () => {
        const file = {
          buffer: makeRow(['김갱신', 'update@test.com', '', '', '']),
        } as Express.Multer.File;
        mockPrisma.customer.upsert.mockResolvedValue({});

        await service.importFromFile(file);

        const upsertCall = mockPrisma.customer.upsert.mock.calls[0][0];
        // update에는 빈 값이 전달되지 않아야 함 (= 기존 값 보존)
        expect(upsertCall.update).toEqual({ name: '김갱신' });
        expect(upsertCall.update.memo).toBeUndefined();
        expect(upsertCall.update.company).toBeUndefined();
        expect(upsertCall.update.title).toBeUndefined();
      });

      it('memo가 채워진 행은 update에 memo가 포함된다', async () => {
        const file = {
          buffer: makeRow(['김갱신', 'update@test.com', '회사', '과장', '신규 메모']),
        } as Express.Multer.File;
        mockPrisma.customer.upsert.mockResolvedValue({});

        await service.importFromFile(file);

        const upsertCall = mockPrisma.customer.upsert.mock.calls[0][0];
        expect(upsertCall.update).toEqual({
          name: '김갱신',
          company: '회사',
          title: '과장',
          memo: '신규 메모',
        });
      });

      it('create 측에는 항상 모든 필드가 (빈 문자열이라도) 전달된다', async () => {
        const file = {
          buffer: makeRow(['김신규', 'new@test.com', '', '', '']),
        } as Express.Multer.File;
        mockPrisma.customer.upsert.mockResolvedValue({});

        await service.importFromFile(file);

        const upsertCall = mockPrisma.customer.upsert.mock.calls[0][0];
        expect(upsertCall.create).toEqual({
          name: '김신규',
          email: 'new@test.com',
          company: '',
          title: '',
          memo: '',
        });
      });
    });
  });
});
