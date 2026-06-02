
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Customer, Tone, Language, MailLog } from '../types';
import { aiApi, mailApi } from '../services/apiService';

interface EmailComposerProps {
  customer: Customer;
}

const LANG_NAMES: Record<Language, string> = {
  ko: '한국어',
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
};

const EmailComposer: React.FC<EmailComposerProps> = ({ customer }) => {
  const [tone, setTone] = useState<Tone>('FORMAL');
  const [lang, setLang] = useState<Language>('ko');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 발송
  const [sending, setSending] = useState(false);

  // 예약 발송 모달
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // 작성 기록 모달
  const [historyModal, setHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<MailLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 첨부 파일
  const [attachments, setAttachments] = useState<File[]>([]);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 토스트
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // textarea ref (포맷 툴바용)
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ─── 토스트 표시 ─────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── AI 메일 생성 ────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. 초안 생성 (한국어)
      let result = await aiApi.draft(customer.id);

      // 2. 말투 변경 (친근하게 선택 시)
      if (tone === 'FRIENDLY') {
        result = await aiApi.tone(result.subject, result.body, 'casual');
      }

      // 3. 언어 번역 (한국어 외)
      if (lang !== 'ko') {
        result = await aiApi.translate(result.subject, result.body, LANG_NAMES[lang]);
      }

      setSubject(result.subject);
      setBody(result.body);
    } catch (error) {
      showToast('error', 'AI 메일 생성 중 오류가 발생했습니다: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [customer, tone, lang]);

  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 말투 / 언어 변환 (기존 내용에 즉시 적용) ───────────────
  const handleToneChange = async (newTone: Tone) => {
    setTone(newTone);
    if (!subject && !body) return;
    setIsLoading(true);
    try {
      const result = await aiApi.tone(subject, body, newTone === 'FORMAL' ? 'formal' : 'casual');
      setSubject(result.subject);
      setBody(result.body);
    } catch (error) {
      showToast('error', '말투 변환 실패: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLangChange = async (newLang: Language) => {
    setLang(newLang);
    if (!subject && !body) return;
    setIsLoading(true);
    try {
      const result = await aiApi.translate(subject, body, LANG_NAMES[newLang]);
      setSubject(result.subject);
      setBody(result.body);
    } catch (error) {
      showToast('error', '번역 실패: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 즉시 발송 ──────────────────────────────────────────────
  const handleSendNow = async () => {
    if (!subject.trim() || !body.trim()) {
      showToast('error', '제목과 본문을 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      await mailApi.send({
        toEmail: customer.email,
        subject,
        body,
        customerId: customer.id,
      });
      showToast('success', `${customer.email}로 메일이 발송되었습니다.`);
    } catch (e) {
      showToast('error', '발송 실패: ' + (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  // ─── 예약 발송 ──────────────────────────────────────────────
  const openScheduleModal = () => {
    // 기본값: 내일 오전 9시
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setScheduleDate(tomorrow.toISOString().slice(0, 16));
    setScheduleModal(true);
  };

  const handleScheduleSubmit = async () => {
    if (!subject.trim() || !body.trim()) {
      showToast('error', '제목과 본문을 먼저 작성해주세요.');
      setScheduleModal(false);
      return;
    }
    if (!scheduleDate) {
      showToast('error', '발송 예약 시간을 선택해주세요.');
      return;
    }
    setScheduling(true);
    try {
      await mailApi.schedule({
        toEmail: customer.email,
        subject,
        body,
        scheduledAt: new Date(scheduleDate).toISOString(),
        customerId: customer.id,
      });
      setScheduleModal(false);
      showToast('success', `${new Date(scheduleDate).toLocaleString('ko-KR')}에 발송이 예약되었습니다.`);
    } catch (e) {
      showToast('error', '예약 실패: ' + (e as Error).message);
    } finally {
      setScheduling(false);
    }
  };

  // ─── 작성 기록 ──────────────────────────────────────────────
  const handleOpenHistory = async () => {
    setHistoryModal(true);
    setHistoryLoading(true);
    try {
      const allLogs = await mailApi.getLogs();
      const filtered = allLogs.filter(
        (l) => l.toEmail === customer.email || l.customerId === customer.id,
      );
      setHistoryLogs(filtered);
    } catch {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ─── 포맷 툴바 ──────────────────────────────────────────────
  const applyFormat = (type: 'bold' | 'italic' | 'list' | 'link') => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);

    let formatted: string;
    switch (type) {
      case 'bold':
        formatted = `**${selected || '굵은 텍스트'}**`;
        break;
      case 'italic':
        formatted = `*${selected || '기울임 텍스트'}*`;
        break;
      case 'list':
        formatted = (selected || '항목').split('\n').map((l) => `• ${l}`).join('\n');
        break;
      case 'link':
        formatted = `[${selected || '링크 텍스트'}](https://)`;
        break;
    }

    const newBody = body.substring(0, start) + formatted + body.substring(end);
    setBody(newBody);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + formatted.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  // ─── 첨부 파일 ──────────────────────────────────────────────
  const handleAttachChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const placeholder = `\n[이미지: ${file.name}]\n`;
    const textarea = bodyRef.current;
    if (textarea) {
      const pos = textarea.selectionStart;
      const newBody = body.substring(0, pos) + placeholder + body.substring(pos);
      setBody(newBody);
    } else {
      setBody((b) => b + placeholder);
    }
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // 예약 최소 시간 (현재 시간 + 5분)
  const minScheduleDate = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden animate-in fade-in duration-300">
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

      <div className="flex flex-wrap gap-2 px-8 pt-6">
        <span className="text-[#616f89] text-sm font-medium">고객 관리</span>
        <span className="text-[#616f89] text-sm font-medium">/</span>
        <span className="text-[#616f89] text-sm font-medium">{customer.name}</span>
        <span className="text-[#616f89] text-sm font-medium">/</span>
        <span className="text-[#111318] text-sm font-bold">AI 메일 작성</span>
      </div>

      <div className="px-8 flex justify-between items-end pb-4">
        <h1 className="text-[#111318] tracking-tight text-3xl font-black leading-tight pt-2">AI 번역 및 교정 도구</h1>
        <button
          onClick={handleOpenHistory}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 transition-colors"
        >
          <span className="material-symbols-outlined text-gray-500 text-lg">history</span>
          작성 기록
        </button>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-6 px-8 py-6 min-h-0 overflow-y-auto">
        {/* 왼쪽 패널: 고객 정보 */}
        <div className="w-full xl:w-1/3 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-0">
            <div className="border-b border-gray-100 px-6 pt-4 flex gap-6">
              <button className="flex flex-col items-center justify-center border-b-2 border-primary text-primary pb-3">
                <p className="text-sm font-black">고객 정보</p>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xl">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">{customer.name}</h3>
                  <p className="text-sm font-medium text-gray-500">
                    {[customer.title, customer.company].filter(Boolean).join(', ') || '정보 없음'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {customer.memo && (
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">핵심 맥락</p>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100/50">
                      <p className="text-sm text-blue-900 leading-relaxed font-medium italic">
                        "{customer.memo}"
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-gray-400 text-lg">mail</span>
                    <span className="text-sm text-gray-600 font-medium">{customer.email}</span>
                  </div>
                  {customer.company && (
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-gray-400 text-lg">business</span>
                      <span className="text-sm text-gray-600 font-medium">{customer.company}</span>
                    </div>
                  )}
                  {customer.title && (
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-gray-400 text-lg">badge</span>
                      <span className="text-sm text-gray-600 font-medium">{customer.title}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 패널: 에디터 */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="bg-white flex-1 rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            {/* 툴바 */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4 bg-gray-50/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  {/* 말투 선택 */}
                  <div className="flex bg-gray-200/50 p-1.5 rounded-xl border border-gray-200 shadow-inner">
                    <button
                      onClick={() => handleToneChange('FORMAL')}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg text-sm font-black flex items-center gap-2 transition-all ${
                        tone === 'FORMAL' ? 'bg-white text-primary shadow-md' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      정중하게
                    </button>
                    <button
                      onClick={() => handleToneChange('FRIENDLY')}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg text-sm font-black flex items-center gap-2 transition-all ${
                        tone === 'FRIENDLY' ? 'bg-white text-primary shadow-md' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">mood</span>
                      친근하게
                    </button>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  {/* 언어 선택 */}
                  <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2 px-3">
                      <span className="material-symbols-outlined text-indigo-600 text-lg">translate</span>
                      <select
                        value={lang}
                        onChange={(e) => handleLangChange(e.target.value as Language)}
                        disabled={isLoading}
                        className="bg-transparent border-none focus:ring-0 text-sm font-bold text-indigo-900 p-0 cursor-pointer"
                      >
                        <option value="ko">한국어</option>
                        <option value="en">영어</option>
                        <option value="ja">일본어</option>
                        <option value="zh">중국어</option>
                      </select>
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={isLoading}
                      className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isLoading && (
                        <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      )}
                      {isLoading ? '생성 중...' : '다시 생성'}
                    </button>
                  </div>
                </div>
                {/* 포맷 툴바 */}
                <div className="flex gap-1 text-gray-400">
                  <button
                    onClick={() => applyFormat('bold')}
                    title="굵게"
                    className="p-2 hover:bg-gray-200 hover:text-gray-700 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">format_bold</span>
                  </button>
                  <button
                    onClick={() => applyFormat('italic')}
                    title="기울임"
                    className="p-2 hover:bg-gray-200 hover:text-gray-700 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">format_italic</span>
                  </button>
                  <button
                    onClick={() => applyFormat('list')}
                    title="목록"
                    className="p-2 hover:bg-gray-200 hover:text-gray-700 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">format_list_bulleted</span>
                  </button>
                  <button
                    onClick={() => applyFormat('link')}
                    title="링크"
                    className="p-2 hover:bg-gray-200 hover:text-gray-700 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">link</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 제목 */}
            <div className="px-8 py-5 border-b border-gray-50 flex items-center">
              <span className="text-sm font-black text-gray-400 w-16 uppercase tracking-widest">제목:</span>
              <input
                className="flex-1 border-none focus:ring-0 p-0 text-gray-900 font-black placeholder-gray-300 text-lg"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="제목을 입력하거나 AI가 생성하도록 하세요"
              />
            </div>

            {/* 본문 */}
            <div className="flex-1 p-8">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-gray-400 font-bold animate-pulse">Claude AI가 최적의 문안을 구성하고 있습니다...</p>
                </div>
              ) : (
                <textarea
                  ref={bodyRef}
                  className="w-full h-full border-none focus:ring-0 p-0 text-gray-700 leading-relaxed text-base resize-none"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="이메일 본문을 입력하세요..."
                />
              )}
            </div>

            {/* 첨부 파일 목록 */}
            {attachments.length > 0 && (
              <div className="px-8 pb-3 flex flex-wrap gap-2">
                {attachments.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-sm">attach_file</span>
                    {f.name}
                    <button
                      onClick={() => removeAttachment(i)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 하단 액션 */}
            <div className="p-8 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-4">
                <input
                  ref={attachInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttachChange}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageInsert}
                />
                <button
                  onClick={() => attachInputRef.current?.click()}
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors font-bold text-sm"
                >
                  <span className="material-symbols-outlined text-xl">attach_file</span>
                  첨부하기
                </button>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors font-bold text-sm"
                >
                  <span className="material-symbols-outlined text-xl">image</span>
                  이미지 삽입
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={openScheduleModal}
                  disabled={sending || scheduling}
                  className="px-6 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm font-black shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-xl">schedule</span>
                  발송 예약
                </button>
                <button
                  onClick={handleSendNow}
                  disabled={sending || isLoading}
                  className="px-10 py-3 rounded-xl bg-primary text-white text-sm font-black shadow-xl shadow-primary/20 hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      발송 중...
                    </>
                  ) : (
                    <>
                      지금 보내기
                      <span className="material-symbols-outlined text-xl">send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 예약 발송 모달 ─────────────────────────────────────── */}
      {scheduleModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setScheduleModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-gray-900">발송 예약</h3>
              <button onClick={() => setScheduleModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">수신인</p>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-gray-400 text-lg">mail</span>
                  <span className="text-sm font-medium text-gray-700">{customer.email}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  발송 예약 시간 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  value={scheduleDate}
                  min={minScheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              {scheduleDate && (
                <p className="text-xs text-gray-500 bg-blue-50 rounded-lg px-3 py-2">
                  <span className="font-bold text-blue-700">
                    {new Date(scheduleDate).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  에 자동 발송됩니다.
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setScheduleModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleScheduleSubmit}
                disabled={scheduling || !scheduleDate}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-black hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scheduling && (
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                예약 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 작성 기록 모달 ─────────────────────────────────────── */}
      {historyModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setHistoryModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-900">작성 기록</h3>
                <p className="text-xs text-gray-500 mt-0.5">{customer.name}님에게 발송된 메일</p>
              </div>
              <button
                onClick={() => setHistoryModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-5xl text-gray-200">mail</span>
                  <p className="text-sm text-gray-400 mt-3 font-medium">발송 기록이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-gray-900 truncate">{log.subject}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{log.body}</p>
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              log.status === 'SUCCESS'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px] leading-none">
                              {log.status === 'SUCCESS' ? 'check_circle' : 'error'}
                            </span>
                            {log.status === 'SUCCESS' ? '발송 성공' : '발송 실패'}
                          </span>
                          <p className="text-[10px] text-gray-400">
                            {new Date(log.sentAt).toLocaleString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailComposer;
