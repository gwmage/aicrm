
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';
import CustomerManagement from '../../../views/CustomerManagement';
import { mockCustomers } from '../handlers';
import { Customer } from '../../../types';

const mockOnSelectCustomer = vi.fn();

const renderComponent = () =>
  render(<CustomerManagement onSelectCustomer={mockOnSelectCustomer} />);

describe('CustomerManagement', () => {
  // ─── 렌더링 ────────────────────────────────────────────────
  describe('초기 렌더링', () => {
    it('제목과 설명 텍스트를 표시한다', async () => {
      renderComponent();

      expect(screen.getByText('고객 관리')).toBeInTheDocument();
      expect(screen.getByText(/고객 리스트를 관리하고/)).toBeInTheDocument();
    });

    it('고객 목록을 로드하여 표시한다', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
        expect(screen.getByText('김미나')).toBeInTheDocument();
      });
    });

    it('고객 회사명과 직함을 표시한다', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('테크코리아')).toBeInTheDocument();
        expect(screen.getByText('CTO')).toBeInTheDocument();
      });
    });

    it('API 오류 시 로딩 스피너가 사라진다', async () => {
      server.use(
        http.get('/api/customers', () => HttpResponse.json({ message: 'Server Error' }, { status: 500 })),
      );
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('고객 정보를 불러오는 중...')).not.toBeInTheDocument();
      });
    });
  });

  // ─── 검색 ─────────────────────────────────────────────────
  describe('검색 기능', () => {
    it('검색 입력란에 텍스트 입력 시 API를 호출한다', async () => {
      let capturedSearch: string | null = null;
      server.use(
        http.get('/api/customers', ({ request }) => {
          capturedSearch = new URL(request.url).searchParams.get('search');
          return HttpResponse.json(
            capturedSearch ? [mockCustomers[0]] : mockCustomers,
          );
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      const input = screen.getByPlaceholderText('이름, 회사 또는 이메일로 검색하세요');
      await userEvent.type(input, '테크코리아');

      await waitFor(() => {
        expect(capturedSearch).toBe('테크코리아');
      }, { timeout: 1000 });
    });

    it('검색 결과가 없으면 빈 상태 메시지를 표시한다', async () => {
      server.use(
        http.get('/api/customers', () => HttpResponse.json([])),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/등록된 고객이 없습니다/)).toBeInTheDocument();
      });
    });
  });

  // ─── 필터 탭 ──────────────────────────────────────────────
  describe('필터 탭', () => {
    it('전체 고객 탭이 기본 선택된다', async () => {
      renderComponent();

      const allTab = screen.getByRole('button', { name: '전체 고객' });
      expect(allTab).toHaveClass('font-bold');
    });

    it('최근 추가 탭 클릭 시 최근 5개만 표시한다', async () => {
      // 6개 고객 데이터 설정
      const sixCustomers: Customer[] = Array.from({ length: 6 }, (_, i) => ({
        ...mockCustomers[0],
        id: i + 1,
        name: `고객${i + 1}`,
        email: `customer${i + 1}@test.com`,
      }));
      server.use(http.get('/api/customers', () => HttpResponse.json(sixCustomers)));

      renderComponent();
      await waitFor(() => expect(screen.getByText('고객1')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '최근 추가' }));

      // 최근 5개만 표시 (6번째는 안보임)
      await waitFor(() => {
        expect(screen.getByText('고객1')).toBeInTheDocument();
        expect(screen.getByText('고객5')).toBeInTheDocument();
        expect(screen.queryByText('고객6')).not.toBeInTheDocument();
      });
    });
  });

  // ─── 고객 추가 모달 ────────────────────────────────────────
  describe('고객 추가 모달', () => {
    it('고객 추가 버튼 클릭 시 모달이 열린다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /고객 추가/ }));

      expect(screen.getByText('새 고객 추가')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('홍길동')).toBeInTheDocument();
    });

    it('취소 버튼 클릭 시 모달이 닫힌다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /고객 추가/ }));
      expect(screen.getByText('새 고객 추가')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '취소' }));
      expect(screen.queryByText('새 고객 추가')).not.toBeInTheDocument();
    });

    it('이름과 이메일 없이 제출하면 오류 메시지를 표시한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /고객 추가/ }));
      fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));

      await waitFor(() => {
        expect(screen.getByText('이름과 이메일은 필수입니다.')).toBeInTheDocument();
      });
    });

    it('유효한 데이터로 고객 추가 후 목록을 새로고침한다', async () => {
      let postCalled = false;
      server.use(
        http.post('/api/customers', () => {
          postCalled = true;
          return HttpResponse.json(
            { id: 999, name: '신규고객', email: 'new@test.com', company: null, title: null, memo: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { status: 201 },
          );
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /고객 추가/ }));

      await userEvent.type(screen.getByPlaceholderText('홍길동'), '신규고객');
      await userEvent.type(screen.getByPlaceholderText('hong@example.com'), 'new@test.com');

      fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));

      await waitFor(() => expect(postCalled).toBe(true));
    });

    it('중복 이메일 오류 시 모달에 서버 오류 메시지를 표시한다', async () => {
      server.use(
        http.post('/api/customers', () =>
          HttpResponse.json({ message: '이미 등록된 이메일입니다: hong@techkorea.com' }, { status: 409 }),
        ),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /고객 추가/ }));
      await userEvent.type(screen.getByPlaceholderText('홍길동'), '중복고객');
      await userEvent.type(screen.getByPlaceholderText('hong@example.com'), 'hong@techkorea.com');

      fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));

      await waitFor(() => {
        expect(screen.getByText(/이미 등록된 이메일/)).toBeInTheDocument();
      });
    });
  });

  // ─── 고객 수정 모달 ────────────────────────────────────────
  describe('고객 수정 모달', () => {
    it('수정 버튼 클릭 시 기존 데이터가 채워진 모달이 열린다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      const editButtons = screen.getAllByTitle ? screen.getAllByRole('button') : [];
      // edit 아이콘 버튼 클릭
      const allButtons = screen.getAllByRole('button');
      const editBtn = allButtons.find((b) => b.querySelector('.material-symbols-outlined')?.textContent === 'edit');
      if (editBtn) fireEvent.click(editBtn);

      await waitFor(() => {
        expect(screen.getByText('고객 정보 수정')).toBeInTheDocument();
        // 기존 이름이 input에 채워져 있어야 함
        const nameInput = screen.getByDisplayValue('홍길동');
        expect(nameInput).toBeInTheDocument();
      });
    });
  });

  // ─── 고객 삭제 ────────────────────────────────────────────
  describe('고객 삭제', () => {
    it('삭제 버튼 클릭 시 확인 모달이 열린다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      const allButtons = screen.getAllByRole('button');
      const deleteBtn = allButtons.find((b) => b.querySelector('.material-symbols-outlined')?.textContent === 'delete');
      if (deleteBtn) fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText('고객 삭제')).toBeInTheDocument();
        expect(screen.getAllByText(/홍길동/).length).toBeGreaterThan(0);
      });
    });

    it('삭제 확인 후 API를 호출한다', async () => {
      let deleteCalled = false;
      server.use(
        http.delete('/api/customers/:id', () => {
          deleteCalled = true;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      const allButtons = screen.getAllByRole('button');
      const deleteBtn = allButtons.find((b) => b.querySelector('.material-symbols-outlined')?.textContent === 'delete');
      if (deleteBtn) fireEvent.click(deleteBtn);

      await waitFor(() => expect(screen.getByText('고객 삭제')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: '삭제' }));

      await waitFor(() => expect(deleteCalled).toBe(true));
    });
  });

  // ─── AI 메일 작성 ──────────────────────────────────────────
  describe('AI 메일 작성 버튼', () => {
    it('AI 메일 작성 버튼 클릭 시 onSelectCustomer 콜백을 호출한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      const aiMailButtons = screen.getAllByRole('button', { name: 'AI 메일 작성' });
      fireEvent.click(aiMailButtons[0]);

      expect(mockOnSelectCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: '홍길동' }),
      );
    });
  });

  // ─── 페이지네이션 ─────────────────────────────────────────
  describe('페이지네이션', () => {
    it('10개 이하면 페이지네이션을 표시하지 않는다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());

      // 총 2명으로 paginate UI가 없어야 함
      expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    });

    it('10개 초과면 페이지네이션을 표시한다', async () => {
      const manyCustomers: Customer[] = Array.from({ length: 15 }, (_, i) => ({
        ...mockCustomers[0],
        id: i + 1,
        name: `고객${i + 1}`,
        email: `c${i + 1}@test.com`,
      }));
      server.use(http.get('/api/customers', () => HttpResponse.json(manyCustomers)));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      });
    });
  });
});
