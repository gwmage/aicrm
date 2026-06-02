import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // 고객 등록 (기능 01)
  async create(dto: CreateCustomerDto) {
    const exists = await this.prisma.customer.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException(`이미 등록된 이메일입니다: ${dto.email}`);
    }
    return this.prisma.customer.create({ data: dto });
  }

  // 고객 목록 조회 (기능 02) - 검색 필터 포함
  async findAll(search?: string) {
    if (!search) {
      return this.prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { company: { contains: search } },
          { email: { contains: search } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 고객 단건 조회
  async findOne(id: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`고객을 찾을 수 없습니다: ID ${id}`);
    return customer;
  }

  // 고객 수정 (기능 05)
  async update(id: number, dto: UpdateCustomerDto) {
    await this.findOne(id);
    if (dto.email) {
      const dup = await this.prisma.customer.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (dup) throw new ConflictException(`이미 사용 중인 이메일입니다: ${dto.email}`);
    }
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  // 고객 삭제 (기능 05)
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }

  // 파일로 명단 올리기 (기능 03) - Excel/CSV 파싱
  async importFromFile(file: Express.Multer.File): Promise<{
    created: number;
    skipped: number;
    errors: string[];
  }> {
    if (!file) throw new BadRequestException('파일이 없습니다.');

    let rows: any[] = [];

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
      throw new BadRequestException('파일을 읽을 수 없습니다. Excel(XLSX) 또는 CSV 형식이어야 합니다.');
    }

    if (rows.length === 0) {
      throw new BadRequestException('파일에 데이터가 없습니다.');
    }

    const result = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      // 컬럼 이름 유연하게 매핑 (한글/영문 모두 지원)
      const name = row['이름'] || row['name'] || row['Name'] || '';
      const email = row['이메일'] || row['email'] || row['Email'] || '';
      const company = row['회사명'] || row['company'] || row['Company'] || '';
      const title = row['직함'] || row['title'] || row['Title'] || '';
      const memo = row['메모'] || row['memo'] || row['Memo'] || '';

      if (!name || !email) {
        result.errors.push(`필수값 누락 (이름: "${name}", 이메일: "${email}")`);
        result.skipped++;
        continue;
      }

      // 이메일 형식 간단 검사
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        result.errors.push(`잘못된 이메일 형식: "${email}"`);
        result.skipped++;
        continue;
      }

      try {
        // 기존 고객 갱신 시 빈 값으로 덮어쓰지 않도록 채워진 필드만 update에 전달
        const updateData: Record<string, string> = { name };
        if (company) updateData.company = company;
        if (title) updateData.title = title;
        if (memo) updateData.memo = memo;

        await this.prisma.customer.upsert({
          where: { email },
          update: updateData,
          create: { name, email, company, title, memo },
        });
        result.created++;
      } catch {
        result.errors.push(`저장 실패: ${email}`);
        result.skipped++;
      }
    }

    return result;
  }
}
