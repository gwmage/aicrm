import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // POST /api/customers - 고객 등록 (기능 01)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  // GET /api/customers?search=키워드 - 고객 목록 조회 (기능 02)
  @Get()
  findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search);
  }

  // GET /api/customers/:id - 고객 단건 조회
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOne(id);
  }

  // PUT /api/customers/:id - 고객 수정 (기능 05)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto);
  }

  // DELETE /api/customers/:id - 고객 삭제 (기능 05)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.remove(id);
  }

  // POST /api/customers/import - 파일 업로드로 명단 올리기 (기능 03)
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
        ];
        if (
          allowed.includes(file.mimetype) ||
          file.originalname.match(/\.(xlsx|xls|csv)$/i)
        ) {
          cb(null, true);
        } else {
          cb(new Error('Excel(XLSX) 또는 CSV 파일만 업로드 가능합니다.'), false);
        }
      },
    }),
  )
  importFromFile(@UploadedFile() file: Express.Multer.File) {
    return this.customersService.importFromFile(file);
  }
}
