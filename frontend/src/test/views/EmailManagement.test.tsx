
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';
import EmailManagement from '../../../views/EmailManagement';
import { mockMailLogs, mockScheduledMails, mockSmtpStatus } from '../handlers';

const renderComponent = () => render(<EmailManagement />);

describe('EmailManagement', () => {
  // ─── 초기 렌더링 ───────────────────────────────────────────
  describe('초기 렌더링', () => {
    it('제목과 설명 텍스트를 표시한다', async () => {
      renderComponent();
      expect(screen.getByText('발송 및 예약 관리')).toBeInTheDocument();
      expect(screen.getByText(/발송된 메일과 예약된 메일의 상태를/)).toBeInTheDocument();
    });

    it('발송 완료 내역 탭이 기본으로 선택된다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());
    });

    it('발송 기록 데이터를 표시한다', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('mina@innovate.io')).toBeInTheDocument();
        expect(screen.getByText('AI CRM 소개')).toBeInTheDocument();
      });
    });

    it('실패한 메일의 오류 메시지를 표시한다', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('SMTP 연결 오류')).toBeInTheDocument();
      });
    });

    it('SMTP 연결 상태 카드를 표시한다', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('SMTP 연결 활성화됨')).toBeInTheDocument();
      });
    });
  });

  // ─── 탭 전환 ──────────────────────────────────────────────
  describe('탭 전환', () => {
    it('예약된 메일 탭 클릭 시 예약 데이터를 표시한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /예약된 메일/ }));

      await waitFor(() => {
        expect(screen.getByText('hong@techkorea.com')).toBeInTheDocument();
        expect(screen.getByText('견적서 안내')).toBeInTheDocument();
      });
    });

    it('발송 완료 내역 탭 클릭 시 발송 기록을 표시한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /예약된 메일/ }));
      await waitFor(() => expect(screen.getByText('견적서 안내')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /발송 완료 내역/ }));
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());
    });

    it('탭에 각 항목 개수를 표시한다', async () => {
      renderComponent();
      await waitFor(() => {
        // mockScheduledMails.length = 1, mockMailLogs.length = 2
        const scheduledBadge = screen.getByText(`${mockScheduledMails.length}`);
        const logsBadge = screen.getByText(`${mockMailLogs.length}`);
        expect(scheduledBadge).toBeInTheDocument();
        expect(logsBadge).toBeInTheDocument();
      });
    });
  });

  // ─── 예약 취소 ────────────────────────────────────────────
  describe('예약 취소', () => {
    beforeEach(() => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('예약 취소 버튼 클릭 후 confirm 승인 시 API를 호출한다', async () => {
      let cancelCalled = false;
      server.use(
        http.delete('/api/mail/scheduled/:id', () => {
          cancelCalled = true;
          return HttpResponse.json({ id: 10, status: 'CANCELLED', updatedAt: new Date().toISOString() });
        }),
      );

      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /예약된 메일/ }));
      await waitFor(() => expect(screen.getByText('견적서 안내')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /예약 취소/ }));

      await waitFor(() => expect(cancelCalled).toBe(true));
    });

    it('confirm 취소 시 API를 호출하지 않는다', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      let cancelCalled = false;
      server.use(
        http.delete('/api/mail/scheduled/:id', () => {
          cancelCalled = true;
          return HttpResponse.json({ id: 10, status: 'CANCELLED', updatedAt: new Date().toISOString() });
        }),
      );

      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /예약된 메일/ }));
      await waitFor(() => expect(screen.getByText('견적서 안내')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /예약 취소/ }));

      expect(cancelCalled).toBe(false);
    });
  });

  // ─── 발송 기록 상세 모달 ──────────────────────────────────
  describe('발송 기록 상세 모달', () => {
    it('상세 보기 버튼 클릭 시 모달이 열린다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      const detailButtons = screen.getAllByRole('button', { name: /상세 보기/ });
      fireEvent.click(detailButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('발송 기록 상세')).toBeInTheDocument();
      });
    });

    it('상세 모달에 수신인과 제목을 표시한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      const detailButtons = screen.getAllByRole('button', { name: /상세 보기/ });
      fireEvent.click(detailButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('발송 기록 상세')).toBeInTheDocument();
        expect(screen.getAllByText('mina@innovate.io').length).toBeGreaterThan(0);
      });
    });

    it('닫기 버튼 클릭 시 모달이 닫힌다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      const detailButtons = screen.getAllByRole('button', { name: /상세 보기/ });
      fireEvent.click(detailButtons[0]);
      await waitFor(() => expect(screen.getByText('발송 기록 상세')).toBeInTheDocument());

      // 닫기 버튼 클릭 (X 버튼 = close icon)
      const modal = screen.getByText('발송 기록 상세').closest('div')!;
      const closeBtn = modal.querySelector('button');
      if (closeBtn) fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText('발송 기록 상세')).not.toBeInTheDocument();
      });
    });

    it('API 오류 시 모달이 열리지 않는다', async () => {
      server.use(
        http.get('/api/mail/logs/:id', () =>
          HttpResponse.json({ message: '기록을 찾을 수 없습니다.' }, { status: 404 }),
        ),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      const detailButtons = screen.getAllByRole('button', { name: /상세 보기/ });
      fireEvent.click(detailButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('발송 기록 상세')).not.toBeInTheDocument();
      });
    });
  });

  // ─── SMTP 상태 카드 ────────────────────────────────────────
  describe('SMTP 상태 카드', () => {
    it('연결 상태일 때 연결된 이메일을 표시한다', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/sender@company.com/)).toBeInTheDocument();
      });
    });

    it('미연결 상태일 때 연결 없음 메시지를 표시한다', async () => {
      server.use(
        http.get('/api/mail/smtp/status', () =>
          HttpResponse.json({ connected: false, email: null }),
        ),
      );
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('SMTP 연결 없음')).toBeInTheDocument();
      });
    });

    it('연결 상태일 때 연결 테스트 버튼을 표시한다', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '연결 테스트' })).toBeInTheDocument();
      });
    });

    it('미연결 상태일 때 연결 테스트 버튼이 없다', async () => {
      server.use(
        http.get('/api/mail/smtp/status', () =>
          HttpResponse.json({ connected: false, email: null }),
        ),
      );
      renderComponent();
      await waitFor(() => expect(screen.getByText('SMTP 연결 없음')).toBeInTheDocument());

      expect(screen.queryByRole('button', { name: '연결 테스트' })).not.toBeInTheDocument();
    });
  });

  // ─── SMTP 연결 테스트 ──────────────────────────────────────
  describe('SMTP 연결 테스트', () => {
    it('연결 테스트 버튼 클릭 시 API를 호출하고 성공 메시지를 표시한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByRole('button', { name: '연결 테스트' })).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '연결 테스트' }));

      await waitFor(() => {
        expect(screen.getByText('SMTP 연결이 성공적으로 확인되었습니다.')).toBeInTheDocument();
      });
    });
  });

  // ─── SMTP 설정 모달 ────────────────────────────────────────
  describe('SMTP 설정 모달', () => {
    it('설정 버튼 클릭 시 모달이 열린다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('SMTP 연결 활성화됨')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '연결 설정 변경' }));

      expect(screen.getByText('SMTP 연결 설정')).toBeInTheDocument();
    });

    it('모달에 기존 이메일이 채워진다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('SMTP 연결 활성화됨')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '연결 설정 변경' }));

      expect(screen.getByDisplayValue(mockSmtpStatus.email!)).toBeInTheDocument();
    });

    it('이메일/비밀번호 없이 저장하면 오류를 표시한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('SMTP 연결 활성화됨')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '연결 설정 변경' }));

      // 이메일 필드 비우기
      const emailInput = screen.getByPlaceholderText('myapp@gmail.com');
      fireEvent.change(emailInput, { target: { value: '' } });

      fireEvent.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(screen.getByText('이메일과 앱 비밀번호를 모두 입력해주세요.')).toBeInTheDocument();
      });
    });

    it('유효한 데이터로 저장 시 API를 호출하고 모달이 닫힌다', async () => {
      let saveCalled = false;
      server.use(
        http.post('/api/mail/smtp', () => {
          saveCalled = true;
          return HttpResponse.json({ id: 1, email: 'new@gmail.com', host: 'smtp.gmail.com', port: 587 });
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('SMTP 연결 활성화됨')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '연결 설정 변경' }));

      const passwordInput = screen.getByPlaceholderText('xxxx xxxx xxxx xxxx');
      fireEvent.change(passwordInput, { target: { value: 'test-app-password' } });

      fireEvent.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(saveCalled).toBe(true);
        expect(screen.queryByText('SMTP 연결 설정')).not.toBeInTheDocument();
      });
    });

    it('취소 버튼 클릭 시 모달이 닫힌다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('SMTP 연결 활성화됨')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '연결 설정 변경' }));
      expect(screen.getByText('SMTP 연결 설정')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '취소' }));
      expect(screen.queryByText('SMTP 연결 설정')).not.toBeInTheDocument();
    });

    it('서버 오류 시 모달에 오류 메시지를 표시한다', async () => {
      server.use(
        http.post('/api/mail/smtp', () =>
          HttpResponse.json({ message: 'SMTP 설정 저장 실패' }, { status: 500 }),
        ),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('SMTP 연결 활성화됨')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '연결 설정 변경' }));

      const passwordInput = screen.getByPlaceholderText('xxxx xxxx xxxx xxxx');
      fireEvent.change(passwordInput, { target: { value: 'test-password' } });

      fireEvent.click(screen.getByRole('button', { name: '저장' }));

      await waitFor(() => {
        expect(screen.getByText('SMTP 설정 저장 실패')).toBeInTheDocument();
      });
    });
  });

  // ─── 새로고침 ─────────────────────────────────────────────
  describe('새로고침', () => {
    it('새로고침 버튼 클릭 시 데이터를 다시 불러온다', async () => {
      let callCount = 0;
      server.use(
        http.get('/api/mail/logs', () => {
          callCount++;
          return HttpResponse.json(mockMailLogs);
        }),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());
      const initialCount = callCount;

      fireEvent.click(screen.getByRole('button', { name: /새로고침/ }));

      await waitFor(() => expect(callCount).toBeGreaterThan(initialCount));
    });
  });

  // ─── 내보내기 ─────────────────────────────────────────────
  describe('내보내기', () => {
    it('내보내기 버튼이 존재한다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      expect(screen.getByRole('button', { name: /내보내기/ })).toBeInTheDocument();
    });
  });

  // ─── 빈 상태 ─────────────────────────────────────────────
  describe('빈 상태', () => {
    it('발송 기록이 없으면 빈 상태 메시지를 표시한다', async () => {
      server.use(
        http.get('/api/mail/logs', () => HttpResponse.json([])),
        http.get('/api/mail/scheduled', () => HttpResponse.json([])),
      );

      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('발송 기록이 없습니다.')).toBeInTheDocument();
      });
    });

    it('예약 메일이 없으면 빈 상태 메시지를 표시한다', async () => {
      server.use(
        http.get('/api/mail/logs', () => HttpResponse.json([])),
        http.get('/api/mail/scheduled', () => HttpResponse.json([])),
      );

      renderComponent();
      await waitFor(() => expect(screen.getByText('발송 기록이 없습니다.')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /예약된 메일/ }));
      await waitFor(() => {
        expect(screen.getByText('예약된 메일이 없습니다.')).toBeInTheDocument();
      });
    });
  });

  // ─── 페이지네이션 ─────────────────────────────────────────
  describe('페이지네이션', () => {
    it('10개 이하면 페이지네이션을 표시하지 않는다', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('AI CRM 소개')).toBeInTheDocument());

      expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    });

    it('10개 초과면 페이지네이션을 표시한다', async () => {
      const manyLogs = Array.from({ length: 15 }, (_, i) => ({
        ...mockMailLogs[0],
        id: i + 1,
        toEmail: `user${i + 1}@test.com`,
        subject: `메일 ${i + 1}`,
      }));
      server.use(http.get('/api/mail/logs', () => HttpResponse.json(manyLogs)));

      renderComponent();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      });
    });
  });
});
