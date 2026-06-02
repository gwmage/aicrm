
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { customersApi } from '../services/apiService';
import { Customer } from '../types';

interface CustomerManagementProps {
  onSelectCustomer: (customer: Customer) => void;
}

const PAGE_SIZE = 10;

const EMPTY_FORM = { name: '', email: '', company: '', title: '', memo: '' };

const CustomerManagement: React.FC<CustomerManagementProps> = ({ onSelectCustomer }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'draft'>('all');
  const [page, setPage] = useState(1);

  // 모달 상태
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 파일 import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // 검색 디바운스
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 데이터 로드 ────────────────────────────────────────────
  const fetchCustomers = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const data = await customersApi.list(searchTerm || undefined);
      setCustomers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers('');
  }, [fetchCustomers]);

  // ─── 검색 디바운스 ──────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchCustomers(value);
    }, 300);
  };

  // ─── 필터 적용 (클라이언트사이드) ───────────────────────────
  const getFilteredCustomers = () => {
    if (activeFilter === 'recent') {
      return [...customers].slice(0, 5);
    }
    return customers;
  };

  const filtered = getFilteredCustomers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── 모달 열기/닫기 ─────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModal('add');
  };

  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({
      name: c.name,
      email: c.email,
      company: c.company || '',
      title: c.title || '',
      memo: c.memo || '',
    });
    setFormError('');
    setModal('edit');
  };

  const openDelete = (c: Customer) => {
    setDeleteTarget(c);
    setModal('delete');
  };

  const closeModal = () => {
    setModal(null);
    setEditTarget(null);
    setDeleteTarget(null);
    setFormError('');
  };

  // ─── CRUD ───────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('이름과 이메일은 필수입니다.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await customersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        title: form.title.trim() || undefined,
        memo: form.memo.trim() || undefined,
      });
      closeModal();
      setPage(1);
      fetchCustomers(search);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('이름과 이메일은 필수입니다.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await customersApi.update(editTarget.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        title: form.title.trim(),
        memo: form.memo.trim(),
      });
      closeModal();
      fetchCustomers(search);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await customersApi.delete(deleteTarget.id);
      closeModal();
      setPage(1);
      fetchCustomers(search);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 파일 가져오기 ──────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await customersApi.import(file);
      const msg = [
        `${res.created}명 추가됨`,
        res.skipped > 0 ? `${res.skipped}명 건너뜀` : '',
        res.errors.length > 0 ? `오류: ${res.errors.slice(0, 3).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' / ');
      alert(`파일 가져오기 완료\n${msg}`);
      setPage(1);
      fetchCustomers(search);
    } catch (err) {
      alert('파일 가져오기 실패: ' + (err as Error).message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // ─── 페이지네이션 렌더 ──────────────────────────────────────
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

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-10 animate-in fade-in duration-500">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-[#111318] text-3xl font-black leading-tight tracking-tight">고객 관리</h2>
          <p className="text-[#616f89] text-sm font-normal">고객 리스트를 관리하고 AI를 활용한 맞춤형 이메일을 작성하세요.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 rounded-lg h-10 px-4 bg-white border border-[#dbdfe6] text-[#111318] text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">{importing ? 'hourglass_empty' : 'upload_file'}</span>
            <span>{importing ? '가져오는 중...' : '파일 불러오기'}</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>고객 추가</span>
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">search</span>
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#dbdfe6] rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="이름, 회사 또는 이메일로 검색하세요"
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* 테이블 카드 */}
      <div className="bg-white rounded-2xl border border-[#dbdfe6] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#dbdfe6]">
          <div className="flex gap-2">
            {(['all', 'recent'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setPage(1); }}
                className={`px-4 py-1.5 text-xs rounded-lg transition-colors ${
                  activeFilter === f
                    ? 'font-bold bg-[#f0f2f4] text-[#111318]'
                    : 'font-medium text-[#616f89] hover:bg-[#f0f2f4]'
                }`}
              >
                {f === 'all' ? '전체 고객' : '최근 추가'}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#616f89] font-medium">
            총 <span className="font-bold text-[#111318]">{filtered.length}</span>명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fb]">
                <th className="px-6 py-4 text-[#111318] text-[10px] font-bold uppercase tracking-wider">이름</th>
                <th className="px-6 py-4 text-[#111318] text-[10px] font-bold uppercase tracking-wider">회사</th>
                <th className="px-6 py-4 text-[#111318] text-[10px] font-bold uppercase tracking-wider">직함</th>
                <th className="px-6 py-4 text-[#111318] text-[10px] font-bold uppercase tracking-wider">이메일</th>
                <th className="px-6 py-4 text-[#111318] text-[10px] font-bold uppercase tracking-wider">등록일</th>
                <th className="px-6 py-4 text-right text-[#111318] text-[10px] font-bold uppercase tracking-wider">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dbdfe6]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <p className="text-sm text-gray-400 font-medium">고객 정보를 불러오는 중...</p>
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-5xl text-gray-200">person_search</span>
                      <p className="text-sm text-gray-400 font-medium">
                        {search ? `"${search}"에 대한 검색 결과가 없습니다.` : '등록된 고객이 없습니다.'}
                      </p>
                      {!search && (
                        <button onClick={openAdd} className="text-primary text-sm font-bold hover:underline">
                          첫 번째 고객 추가하기
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                          {customer.name.charAt(0)}
                        </div>
                        <span className="text-[#111318] text-sm font-bold">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-[#616f89] text-sm font-medium">{customer.company || '-'}</td>
                    <td className="px-6 py-5 text-[#616f89] text-sm">{customer.title || '-'}</td>
                    <td className="px-6 py-5 text-[#616f89] text-sm">{customer.email}</td>
                    <td className="px-6 py-5 text-[#616f89] text-sm">{formatDate(customer.createdAt)}</td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => onSelectCustomer(customer)}
                          className="bg-primary text-white text-[11px] font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm active:scale-95"
                        >
                          AI 메일 작성
                        </button>
                        <button
                          onClick={() => openEdit(customer)}
                          className="p-1.5 text-[#616f89] hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => openDelete(customer)}
                          className="p-1.5 text-[#616f89] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between p-5 border-t border-[#dbdfe6] bg-[#f8f9fb]">
            <p className="text-xs text-[#616f89]">
              표시 중:{' '}
              <span className="font-bold text-[#111318]">
                {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filtered.length)}
              </span>{' '}
              (총 <span className="font-bold text-[#111318]">{filtered.length}</span>명)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex size-8 items-center justify-center rounded-lg border border-[#dbdfe6] bg-white text-[#111318] hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {renderPageButtons().map((btn, i) =>
                btn === 'ellipsis' ? (
                  <span key={`e${i}`} className="px-1 text-[#616f89] text-xs font-bold">...</span>
                ) : (
                  <button
                    key={btn}
                    onClick={() => setPage(btn)}
                    className={`text-xs font-bold flex size-8 items-center justify-center rounded-lg transition-colors ${
                      page === btn
                        ? 'text-white bg-primary shadow-sm'
                        : 'text-[#111318] hover:bg-gray-200'
                    }`}
                  >
                    {btn}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex size-8 items-center justify-center rounded-lg border border-[#dbdfe6] bg-white text-[#111318] hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 고객 추가 / 수정 모달 ────────────────────────────── */}
      {(modal === 'add' || modal === 'edit') && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900">
                {modal === 'add' ? '새 고객 추가' : '고객 정보 수정'}
              </h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="홍길동"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="hong@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">회사명</label>
                  <input
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="ABC 주식회사"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">직함</label>
                  <input
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="마케팅 팀장"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">메모</label>
                  <textarea
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                    placeholder="AI 이메일 작성에 활용될 핵심 맥락을 입력하세요..."
                    rows={3}
                    value={form.memo}
                    onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={modal === 'add' ? handleAdd : handleEdit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-black shadow-lg shadow-primary/20 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {modal === 'add' ? '고객 추가' : '수정 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ───────────────────────────────────── */}
      {modal === 'delete' && deleteTarget && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="size-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-red-500">delete</span>
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">고객 삭제</h3>
                <p className="text-sm text-gray-500">이 작업은 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6 bg-gray-50 rounded-xl px-4 py-3">
              <span className="font-black text-gray-900">{deleteTarget.name}</span> 님의 모든 정보가 삭제됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
