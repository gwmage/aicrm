
import React, { useState, useEffect, useCallback } from 'react';
import { mailApi } from '../services/apiService';
import { ScheduledMail, MailLog, SmtpStatus } from '../types';

type ActiveTab = 'scheduled' | 'sent';

const EmailManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sent');

  // 데이터
  const [scheduledMails, setScheduledMails] = useState<ScheduledMail[]>([]);
  const [mailLogs, setMailLogs] = useState<MailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);

  // 페이지네이션
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // 상세 보기 모달
  const [detailLog, setDetailLog] = useState<MailLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // SMTP 설정 모달
  const [smtpModal, setSmtpModal] = useState(false);
  const [smtpForm, setSmtpForm] = useState({ email: '', password: '', host: 'smtp.gmail.com', port: '587' });
  const [smtpSubmitting, setSmtpSubmitting] = useState(false);
  const [smtpError, setSmtpError] = useState('');
  const [smtpTesting, setSmtpTesting] = useState(false);

  // 예약 취소 진행 중
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // 토스트
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── 데이터 로드 ────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduled, logs, smtp] = await Promise.all([
        mailApi.getScheduled(),
        mailApi.getLogs(),
        mailApi.getSmtpStatus(),
      ]);
      setScheduledMails(scheduled);
      setMailLogs(logs);
      setSmtpStatus(smtp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 탭 변경 시 페이지 초기화
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  // ─── 현재 탭 데이터 ─────────────────────────────────────────
  const currentData = activeTab === 'scheduled' ? scheduledMails : mailLogs;
  const totalPages = Math.max(1, Math.ceil(currentData.length / PAGE_SIZE));
  const paged = currentData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── 예약 취소 ──────────────────────────────────────────────
  const handleCancelScheduled = async (id: number) => {
    if (!confirm('이 예약 메일을 취소하시겠습니까?')) return;
    setCancellingId(id);
    try {
      await mailApi.cancelScheduled(id);
      showToast('success', '예약이 취소되었습니다.');
      fetchAll();
    } catch (e) {
      showToast('error', '취소 실패: ' + (e as Error).message);
    } finally {
      setCancellingId(null);
    }
  };

  // ─── 발송 기록 상세 ─────────────────────────────────────────
  const handleViewDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailLog(null);
    try {
      const log = await mailApi.getLog(id);
      setDetailLog(log);
    } catch (e) {
      showToast('error', '상세 조회 실패: ' + (e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── CSV 내보내기 ────────────────────────────────────────────
  const handleExport = () => {
    const headers = activeTab === 'scheduled'
      ? ['ID', '수신인', '제목', '예약 시간', '상태', '등록일']
      : ['ID', '수신인', '제목', '발송일', '상태', '오류'];

    const rows = activeTab === 'scheduled'
      ? scheduledMails.map((m) => [
          m.id,
          m.toEmail,
          m.subject,
          new Date(m.scheduledAt).toLocaleString('ko-KR'),
          m.status,
          new Date(m.createdAt).toLocaleString('ko-KR'),
        ])
      : mailLogs.map((l) => [
          l.id,
          l.toEmail,
          l.subject,
          new Date(l.sentAt).toLocaleString('ko-KR'),
          l.status,
          l.errorMessage || '',
        ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── SMTP 설정 저장 ─────────────────────────────────────────
  const handleOpenSmtp = () => {
    setSmtpForm({
      email: smtpStatus?.email || '',
      password: '',
      host: smtpStatus?.host || 'smtp.gmail.com',
      port: String(smtpStatus?.port || 587),
    });
    setSmtpError('');
    setSmtpModal(true);
  };

  const handleSmtpSave = async () => {
    if (!smtpForm.email.trim() || !smtpForm.password.trim()) {
      setSmtpError('이메일과 앱 비밀번호를 모두 입력해주세요.');
      return;
    }
    setSmtpSubmitting(true);
    setSmtpError('');
    try {
      await mailApi.saveSmtp({
        email: smtpForm.email.trim(),
        password: smtpForm.password.trim(),
        host: smtpForm.host.trim(),
        port: Number(smtpForm.port),
      });
      showToast('success', 'SMTP 설정이 저장되었습니다.');
      setSmtpModal(false);
      fetchAll();
    } catch (e) {
      setSmtpError((e as Error).message);
    } finally {
      setSmtpSubmitting(false);
    }
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    try {
      const res = await mailApi.testSmtp();
      showToast('success', res.message);
    } catch (e) {
      showToast('error', '연결 테스트 실패: ' + (e as Error).message);
    } finally {
      setSmtpTesting(false);
    }
  };

  // ─── 상태 배지 ──────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { color: string; icon: string; label: string }> = {
      SUCCESS: { color: 'bg-green-50 text-green-700 border-green-200', icon: 'check_circle', label: '발송 성공' },
      FAILED: { color: 'bg-red-50 text-red-700 border-red-200', icon: 'error', label: '발송 실패' },
      PENDING: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'schedule', label: '예약됨' },
      SENT: { color: 'bg-green-50 text-green-700 border-green-200', icon: 'check_circle', label: '발송 완료' },
      CANCELLED: { color: 'bg-gray-100 text-gray-500 border-gray-200', icon: 'cancel', label: '취소됨' },
    };
    const c = config[status] || config.PENDING;
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${c.color}`}>
        <span className="material-symbols-outlined text-[14px] leading-none">{c.icon}</span>
        {c.label}
      </div>
    );
  };

  // ─── 페이지네이션 ────────────────────────────────────────────
  const renderPageButtons = () => {
    const buttons: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) buttons.push(i);
    } else {
      buttons.push(1);
      if (page > 3) buttons.push('ellipsis');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        buttons.push(i);
      }
      if (page < totalPages - 2) buttons.push('ellipsis');
      buttons.push(totalPages);
    }
    return buttons;
  };

  return (
    <div className="max-w-6xl w-full mx-auto p-10 space-y-8 animate-in slide-in-from-bottom duration-500">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-white text-sm font-bold animate-in slide-in-from-top-2 duration-300 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[#111318] text-4xl font-black leading-tight tracking-tighter">발송 및 예약 관리</h1>
          <p className="text-[#616f89] text-base font-medium">발송된 메일과 예약된 메일의 상태를 상세하게 모니터링합니다.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl h-12 px-6 bg-white border border-[#dbdfe6] text-[#111318] text-sm font-black hover:bg-gray-50 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-xl">download</span>
            <span>내보내기</span>
          </button>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 rounded-xl h-12 px-6 bg-white border border-[#dbdfe6] text-[#111318] text-sm font-black hover:bg-gray-50 transition-all shadow-sm"
          >
            <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* 메인 카드 */}
      <div className="bg-white rounded-2xl border border-[#dbdfe6] shadow-md overflow-hidden">
        {/* 탭 */}
        <div className="border-b border-[#dbdfe6] px-8 pt-4 flex gap-10">
          <button
            onClick={() => handleTabChange('scheduled')}
            className={`flex flex-col items-center justify-center border-b-[3px] pb-4 pt-4 font-bold text-sm transition-colors ${
              activeTab === 'scheduled'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-[#616f89] hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">schedule</span>
              <span>예약된 메일</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${activeTab === 'scheduled' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                {scheduledMails.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => handleTabChange('sent')}
            className={`flex flex-col items-center justify-center border-b-[3px] pb-4 pt-4 font-bold text-sm transition-colors ${
              activeTab === 'sent'
                ? 'border-primary text-primary font-black tracking-wide'
                : 'border-transparent text-[#616f89] hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">history</span>
              <span>발송 완료 내역</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${activeTab === 'sent' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                {mailLogs.length}
              </span>
            </div>
          </button>
        </div>

        {/* 테이블 */}
        <div className="p-8">
          <div className="rounded-2xl border border-[#dbdfe6] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f9fb]">
                <tr>
                  {activeTab === 'scheduled' ? (
                    <>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">수신인</th>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">제목</th>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">예약 발송 시간</th>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">상태</th>
                      <th className="px-6 py-5 text-right text-[#616f89] text-sm font-black">관리</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">수신인</th>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">제목</th>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">발송일</th>
                      <th className="px-6 py-5 text-[#111318] text-sm font-black">발송 상태</th>
                      <th className="px-6 py-5 text-right text-[#616f89] text-sm font-black">설정</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dbdfe6]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-gray-400 font-medium">불러오는 중...</p>
                      </div>
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <span className="material-symbols-outlined text-5xl text-gray-200">
                        {activeTab === 'scheduled' ? 'schedule' : 'history'}
                      </span>
                      <p className="text-sm text-gray-400 mt-3 font-medium">
                        {activeTab === 'scheduled' ? '예약된 메일이 없습니다.' : '발송 기록이 없습니다.'}
                      </p>
                    </td>
                  </tr>
                ) : activeTab === 'scheduled' ? (
                  (paged as ScheduledMail[]).map((mail) => (
                    <tr key={mail.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-6">
                        <div className="font-black text-[#111318] text-sm">{mail.toEmail}</div>
                        {mail.customer && (
                          <div className="text-xs text-[#616f89] font-medium mt-0.5">
                            {mail.customer.name}
                            {mail.customer.company && ` · ${mail.customer.company}`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-6 text-[#616f89] text-sm font-medium max-w-xs truncate">{mail.subject}</td>
                      <td className="px-6 py-6 text-[#616f89] text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-gray-400">schedule</span>
                          {new Date(mail.scheduledAt).toLocaleString('ko-KR', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <StatusBadge status={mail.status} />
                      </td>
                      <td className="px-6 py-6 text-right">
                        {mail.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelScheduled(mail.id)}
                            disabled={cancellingId === mail.id}
                            className="inline-flex items-center gap-1.5 text-red-500 text-sm font-black hover:bg-red-50 transition-all px-4 py-2 rounded-xl border border-red-200 active:scale-95 shadow-sm disabled:opacity-50"
                          >
                            {cancellingId === mail.id ? (
                              <div className="size-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-base">cancel</span>
                            )}
                            예약 취소
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  (paged as MailLog[]).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-6">
                        <div className="font-black text-[#111318] text-sm">{log.toEmail}</div>
                        {log.customer && (
                          <div className="text-xs text-[#616f89] font-medium mt-0.5">
                            {log.customer.name}
                            {log.customer.company && ` · ${log.customer.company}`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-6 text-[#616f89] text-sm font-medium max-w-xs truncate">{log.subject}</td>
                      <td className="px-6 py-6 text-[#616f89] text-sm whitespace-nowrap font-medium">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-gray-400">calendar_today</span>
                          {new Date(log.sentAt).toLocaleString('ko-KR', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <StatusBadge status={log.status} />
                        {log.errorMessage && (
                          <p className="text-[10px] text-red-500 mt-1 max-w-xs truncate">{log.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-6 py-6 text-right flex items-center justify-end gap-2 min-w-max">
                        {log.status === 'FAILED' && (
                          <button
                            onClick={() => {
                              if (confirm(`${log.toEmail}으로 메일을 재발송하시겠습니까?`)) {
                                mailApi.send({
                                  toEmail: log.toEmail,
                                  subject: log.subject,
                                  body: log.body,
                                  customerId: log.customerId || undefined,
                                }).then(() => {
                                  showToast('success', '메일이 재발송되었습니다.');
                                  fetchAll();
                                }).catch(e => {
                                  showToast('error', '재발송 실패: ' + (e as Error).message);
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 text-orange-600 text-sm font-black hover:bg-orange-50 transition-all px-4 py-2 rounded-xl border border-orange-200 active:scale-95 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base">replay</span>
                            재발송
                          </button>
                        )}
                        <button
                          onClick={() => handleViewDetail(log.id)}
                          className="inline-flex items-center gap-1.5 text-primary text-sm font-black hover:bg-primary/5 transition-all px-4 py-2 rounded-xl border border-primary/20 active:scale-95 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                          상세 보기
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 페이지네이션 */}
        {!loading && currentData.length > PAGE_SIZE && (
          <div className="px-8 pb-8 flex items-center justify-between">
            <p className="text-xs text-[#616f89] font-bold italic">
              총 {currentData.length}개 중{' '}
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, currentData.length)} 표시 중
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-3 border border-[#dbdfe6] rounded-xl text-[#616f89] disabled:opacity-30 bg-white hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-2xl">chevron_left</span>
              </button>
              {renderPageButtons().map((btn, i) =>
                btn === 'ellipsis' ? (
                  <span key={`e${i}`} className="flex items-center px-2 text-[#616f89] text-sm font-bold">...</span>
                ) : (
                  <button
                    key={btn}
                    onClick={() => setPage(btn)}
                    className={`size-12 border rounded-xl text-sm font-bold transition-colors ${
                      page === btn
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-[#616f89] border-[#dbdfe6] hover:bg-slate-100'
                    }`}
                  >
                    {btn}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-3 border border-[#dbdfe6] rounded-xl text-[#616f89] disabled:opacity-30 bg-white hover:bg-slate-100 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-2xl">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SMTP 상태 카드 */}
      <div
        className={`border rounded-3xl p-10 flex flex-col md:flex-row items-center gap-8 shadow-sm ${
          smtpStatus?.connected
            ? 'bg-primary/5 border-primary/20'
            : 'bg-orange-50 border-orange-200'
        }`}
      >
        <div
          className={`p-5 rounded-3xl border shadow-lg ${
            smtpStatus?.connected ? 'bg-white border-primary/10 shadow-primary/5' : 'bg-white border-orange-100'
          }`}
        >
          <span className={`material-symbols-outlined text-5xl ${smtpStatus?.connected ? 'text-primary' : 'text-orange-400'}`}>
            {smtpStatus?.connected ? 'cloud_done' : 'cloud_off'}
          </span>
        </div>
        <div className="flex-1 space-y-2 text-center md:text-left">
          <h3 className="text-[#111318] font-black text-2xl">
            {smtpStatus?.connected ? 'SMTP 연결 활성화됨' : 'SMTP 연결 없음'}
          </h3>
          <p className="text-[#616f89] text-base font-medium leading-relaxed">
            {smtpStatus?.connected ? (
              <>
                {smtpStatus.host} SMTP가 성공적으로 연결되었습니다.{' '}
                <span className="font-black text-[#111318] underline decoration-primary/30 decoration-2 underline-offset-4">
                  {smtpStatus.email}
                </span>{' '}
                계정으로 메일이 발송됩니다.
              </>
            ) : (
              'Google 앱 비밀번호를 연결하면 실제 이메일 발송이 가능합니다.'
            )}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {smtpStatus?.connected && (
            <button
              onClick={handleSmtpTest}
              disabled={smtpTesting}
              className={`whitespace-nowrap rounded-2xl px-6 py-3 font-black text-sm border-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 ${
                smtpStatus?.connected
                  ? 'border-primary/30 text-primary hover:bg-primary/5'
                  : 'border-orange-300 text-orange-500 hover:bg-orange-50'
              }`}
            >
              {smtpTesting ? '테스트 중...' : '연결 테스트'}
            </button>
          )}
          <button
            onClick={handleOpenSmtp}
            className={`whitespace-nowrap rounded-2xl px-8 py-4 border-2 font-black text-base transition-all shadow-sm active:scale-95 ${
              smtpStatus?.connected
                ? 'border-primary text-primary hover:bg-primary hover:text-white'
                : 'bg-orange-400 text-white border-orange-400 hover:bg-orange-500'
            }`}
          >
            {smtpStatus?.connected ? '연결 설정 변경' : 'SMTP 연결하기'}
          </button>
        </div>
      </div>

      {/* ── 발송 기록 상세 모달 ───────────────────────────────── */}
      {(detailLog || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setDetailLog(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-black text-gray-900">발송 기록 상세</h3>
              <button
                onClick={() => setDetailLog(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : detailLog ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">수신인</p>
                      <p className="text-sm font-bold text-gray-900">{detailLog.toEmail}</p>
                      {detailLog.customer && (
                        <p className="text-xs text-gray-500">{detailLog.customer.name} · {detailLog.customer.company}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">발송일</p>
                      <p className="text-sm font-medium text-gray-600">
                        {new Date(detailLog.sentAt).toLocaleString('ko-KR', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">상태</p>
                    <StatusBadge status={detailLog.status} />
                    {detailLog.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{detailLog.errorMessage}</p>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">제목</p>
                    <p className="text-base font-black text-gray-900">{detailLog.subject}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">본문</p>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                      {detailLog.body}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── SMTP 설정 모달 ────────────────────────────────────── */}
      {smtpModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSmtpModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-gray-900">SMTP 연결 설정</h3>
                <p className="text-xs text-gray-500 mt-0.5">Google 앱 비밀번호로 연결하세요.</p>
              </div>
              <button onClick={() => setSmtpModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              {smtpError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                  {smtpError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Gmail 주소 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="myapp@gmail.com"
                  value={smtpForm.email}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  앱 비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={smtpForm.password}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, password: e.target.value }))}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">SMTP 호스트</label>
                  <input
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">포트</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, port: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setSmtpModal(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSmtpSave}
                disabled={smtpSubmitting}
                className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-black shadow-lg shadow-primary/20 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {smtpSubmitting && <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailManagement;
