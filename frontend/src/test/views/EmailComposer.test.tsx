
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';
import EmailComposer from '../../../views/EmailComposer';
import { Customer } from '../../../types';

const mockCustomer: Customer = {
  id: 1,
  name: '홍길동',
  company: '테크코리아',
  title: 'CTO',
  email: 'hong@techkorea.com',
  memo: '엔터프라이즈 라이선스 관심',
  createdAt: '2024-01-15T09:00:00.000Z',
  updatedAt: '2024-01-15T09:00:00.000Z',
};

const renderComponent = () => render(<EmailComposer customer={mockCustomer} />);

describe('EmailComposer', () => {
  // ─── 초기 렌더링 ──────────────────────────────────────────
  describe('초기 렌더링', () => {
    it('브레드크럼에 고객 이름을 표시한다', async () => {
      renderComponent();
      expect(screen.getAllByText('홍길동').length).toBeGreaterThan(0);
    });

    it('마운트 시 AI 초안 생성 로딩 상태를 표시한다', () => {
      renderComponent();
      expect(screen.getByText(/Gemini|Claude|AI가 최적의/)).toBeInTheDocument();
    });

    it('AI 초안 생성 후 제목과 본문을 표시한다', async () => {
      renderComponent();

      await waitFor(() => {
        const subjectInput = screen.getByPlaceholderText('제목을 입력하거나 AI가 생성하도록 하세요');
        expect((subjectInput as HTMLInputElement).value).toMatch(/엔터프라이즈|테크코리아|홍길동/);
      });
    });

    it('고객 이메일을 고객 정보 패널에 표시한다', async () => {
      renderComponent();
      expect(screen.getByText('hong@techkorea.com')).toBeInTheDocument();
    });

    it('고객 메모를 핵심 맥락으로 표시한다', async () => {
      renderComponent();
      expect(screen.getByText(/엔터프라이즈 라이선스 관심/)).toBeInTheDocument();
    });
  });

  // ─── 말투 변환 ─────────────────────────────────────────────
  describe('말투 변환', () => {
    it('초기 상태는 정중하게 버튼이 활성화된다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      const formalBtn = screen.getByRole('button', { name: /정중하게/ });
      expect(formalBtn).toHaveClass('bg-white');
    });

    it('친근하게 버튼 클릭 시 tone API를 호출한다', async () => {
      let toneApiCalled = false;
      let tonePayload: any = null;
      server.use(
        http.post('/api/ai/tone', async ({ request }) => {
          toneApiCalled = true;
          tonePayload = await request.json();
          return HttpResponse.json({ subject: '[친근] 제목', body: '안녕! 잘 지내?' });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /친근하게/ }));

      await waitFor(() => {
        expect(toneApiCalled).toBe(true);
        expect(tonePayload.tone).toBe('casual');
      });
    });

    it('정중하게 버튼 클릭 시 formal tone으로 API를 호출한다', async () => {
      let tonePayload: any = null;
      // 먼저 친근하게로 변경
      server.use(
        http.post('/api/ai/tone', async ({ request }) => {
          tonePayload = await request.json();
          return HttpResponse.json({ subject: '변환된 제목', body: '변환된 본문' });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /정중하게/ }));

      await waitFor(() => {
        expect(tonePayload?.tone).toBe('formal');
      });
    });
  });

  // ─── 언어 변환 ─────────────────────────────────────────────
  describe('언어 변환', () => {
    it('언어 선택 시 translate API를 호출한다', async () => {
      let translatePayload: any = null;
      server.use(
        http.post('/api/ai/translate', async ({ request }) => {
          translatePayload = await request.json();
          return HttpResponse.json({ subject: 'English Subject', body: 'English body.' });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      const langSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(langSelect, 'en');

      await waitFor(() => {
        expect(translatePayload).not.toBeNull();
        expect(translatePayload.targetLanguage).toBe('English');
      });
    });

    it('한국어를 다시 선택해도 translate API를 호출한다', async () => {
      // 컴포넌트는 'ko' 선택 시에도 translate를 호출함 (서버가 한국어로 번역)
      let translateCalled = false;
      server.use(
        http.post('/api/ai/translate', () => {
          translateCalled = true;
          return HttpResponse.json({ subject: '한국어 제목', body: '한국어 본문' });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      // 먼저 영어로 변경 후 한국어로 되돌리기
      const langSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(langSelect, 'en');
      await waitFor(() => expect(translateCalled).toBe(true));

      translateCalled = false;
      await userEvent.selectOptions(langSelect, 'ko');

      await waitFor(() => {
        expect(translateCalled).toBe(true);
      });
    });
  });

  // ─── 다시 생성 ─────────────────────────────────────────────
  describe('다시 생성 버튼', () => {
    it('다시 생성 클릭 시 draft API를 다시 호출한다', async () => {
      let draftCallCount = 0;
      server.use(
        http.post('/api/ai/draft', () => {
          draftCallCount++;
          return HttpResponse.json({ subject: `제목 ${draftCallCount}`, body: `본문 ${draftCallCount}` });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      expect(draftCallCount).toBe(1);

      fireEvent.click(screen.getByRole('button', { name: /다시 생성/ }));

      await waitFor(() => expect(draftCallCount).toBe(2));
    });
  });

  // ─── 포맷 툴바 ─────────────────────────────────────────────
  describe('포맷 툴바', () => {
    it('굵게 버튼 클릭 시 textarea에 **텍스트** 를 삽입한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      const textarea = screen.getByPlaceholderText('이메일 본문을 입력하세요...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '테스트 본문' } });

      textarea.setSelectionRange(0, 5);
      fireEvent.click(screen.getByTitle('굵게'));

      await waitFor(() => {
        expect(textarea.value).toContain('**');
      });
    });

    it('기울임 버튼 클릭 시 *텍스트* 를 삽입한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      const textarea = screen.getByPlaceholderText('이메일 본문을 입력하세요...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '이탤릭 테스트' } });
      textarea.setSelectionRange(0, 3);
      fireEvent.click(screen.getByTitle('기울임'));

      await waitFor(() => {
        expect(textarea.value).toMatch(/\*/);
      });
    });

    it('목록 버튼 클릭 시 • 를 삽입한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      const textarea = screen.getByPlaceholderText('이메일 본문을 입력하세요...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '항목1' } });
      textarea.setSelectionRange(0, 3);
      fireEvent.click(screen.getByTitle('목록'));

      await waitFor(() => {
        expect(textarea.value).toContain('•');
      });
    });
  });

  // ─── 지금 보내기 ──────────────────────────────────────────
  describe('지금 보내기', () => {
    it('제목/본문이 없으면 에러 토스트를 표시한다', async () => {
      // AI 초안 생성이 빈 값을 반환하도록 설정
      server.use(
        http.post('/api/ai/draft', () => HttpResponse.json({ subject: '', body: '' })),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /지금 보내기/ }));

      await waitFor(() => {
        expect(screen.getByText(/제목과 본문을 입력해주세요/)).toBeInTheDocument();
      });
    });

    it('발송 성공 시 성공 토스트를 표시한다', async () => {
      let sendCalled = false;
      server.use(
        http.post('/api/mail/send', () => {
          sendCalled = true;
          return HttpResponse.json({ success: true, logId: 200, sentAt: new Date().toISOString() });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      // 제목/본문이 채워진 상태에서 발송
      fireEvent.click(screen.getByRole('button', { name: /지금 보내기/ }));

      await waitFor(() => {
        expect(sendCalled).toBe(true);
      });

      await waitFor(() => {
        expect(screen.getByText(/hong@techkorea\.com.*발송/)).toBeInTheDocument();
      });
    });

    it('발송 실패 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.post('/api/mail/send', () =>
          HttpResponse.json({ message: 'SMTP 설정이 없습니다.' }, { status: 400 }),
        ),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /지금 보내기/ }));

      await waitFor(() => {
        expect(screen.getByText(/발송 실패/)).toBeInTheDocument();
      });
    });
  });

  // ─── 발송 예약 모달 ────────────────────────────────────────
  describe('발송 예약 모달', () => {
    it('발송 예약 버튼 클릭 시 모달이 열린다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /발송 예약/ }));

      expect(screen.getByRole('heading', { name: '발송 예약' })).toBeInTheDocument();
      expect(screen.getAllByText('hong@techkorea.com').length).toBeGreaterThan(0);
    });

    it('모달에서 취소 클릭 시 닫힌다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /발송 예약/ }));
      expect(screen.getByRole('heading', { name: '발송 예약' })).toBeInTheDocument();

      const cancelBtn = screen.getAllByRole('button', { name: '취소' })[0];
      fireEvent.click(cancelBtn);

      expect(screen.queryByRole('heading', { name: '발송 예약' })).not.toBeInTheDocument();
    });

    it('날짜/시간 선택 후 예약 확정 시 schedule API를 호출한다', async () => {
      let scheduleCalled = false;
      server.use(
        http.post('/api/mail/schedule', () => {
          scheduleCalled = true;
          return HttpResponse.json(
            { id: 10, status: 'PENDING', scheduledAt: new Date().toISOString() },
            { status: 201 },
          );
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /발송 예약/ }));

      // datetime-local 입력에 미래 날짜 설정
      const dateInput = screen.getByDisplayValue(/T/);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
      fireEvent.change(dateInput, { target: { value: tomorrow } });

      fireEvent.click(screen.getByRole('button', { name: '예약 확정' }));

      await waitFor(() => expect(scheduleCalled).toBe(true));
    });
  });

  // ─── 작성 기록 모달 ────────────────────────────────────────
  describe('작성 기록 모달', () => {
    it('작성 기록 버튼 클릭 시 모달이 열리고 API를 호출한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /작성 기록/ }));

      expect(screen.getByText(/홍길동님에게 발송된 메일/)).toBeInTheDocument();

      await waitFor(() => {
        // 해당 고객 이메일과 일치하는 로그는 없으므로 빈 상태
        expect(screen.getByText('발송 기록이 없습니다.')).toBeInTheDocument();
      });
    });

    it('해당 고객의 발송 기록을 필터링하여 표시한다', async () => {
      server.use(
        http.get('/api/mail/logs', () =>
          HttpResponse.json([
            {
              id: 99,
              customerId: 1,
              customer: { id: 1, name: '홍길동', company: null, title: null, email: 'hong@techkorea.com', memo: null },
              toEmail: 'hong@techkorea.com',
              subject: '고객 전용 메일 제목',
              body: '내용',
              sentAt: new Date().toISOString(),
              status: 'SUCCESS',
              errorMessage: null,
            },
          ]),
        ),
      );

      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /작성 기록/ }));

      await waitFor(() => {
        expect(screen.getByText('고객 전용 메일 제목')).toBeInTheDocument();
      });
    });

    it('닫기 버튼 클릭 시 모달이 닫힌다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /작성 기록/ }));
      expect(screen.getByText(/홍길동님에게 발송된 메일/)).toBeInTheDocument();

      // 모달의 닫기 버튼 (close 아이콘)
      const allButtons = screen.getAllByRole('button');
      const closeBtn = allButtons.find((b) => b.querySelector('.material-symbols-outlined')?.textContent === 'close');
      if (closeBtn) fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText(/홍길동님에게 발송된 메일/)).not.toBeInTheDocument();
      });
    });
  });

  // ─── 파일 첨부 ─────────────────────────────────────────────
  describe('파일 첨부', () => {
    it('파일 첨부 후 파일명을 표시한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.queryByText(/생성 중/)).not.toBeInTheDocument());

      const file = new File(['test content'], 'document.pdf', { type: 'application/pdf' });
      const fileInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await waitFor(() => {
        if (fileInput) {
          expect(screen.queryByText('document.pdf')).toBeInTheDocument();
        }
      });
    });
  });
});
