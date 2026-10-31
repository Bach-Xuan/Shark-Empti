'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/firebase';
import { useLanguageState } from '@/components/app-preferences';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { communityRequest } from '@/lib/forum-client';
import { translatedError } from '@/lib/i18n/errors';
import { useMutation } from '@/hooks/use-mutation';
import { z } from 'zod';
import { publicMessages } from '@/lib/i18n/public';

const Queue = z.object({ reports: z.array(z.object({ id: z.string(), target: z.object({ kind: z.string(), id: z.string(), parentId: z.string().optional() }), reason: z.string(), status: z.string(), preview: z.string(), hidden: z.boolean(), exists: z.boolean() })).max(50) });
type Report = z.infer<typeof Queue>['reports'][number];
export default function ModerationPage() {
  const { user } = useUser();
  const [lang] = useLanguageState();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const mounted = useRef(true);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const mutation = useMutation();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const failure = useCallback((cause: unknown) => {
    if (mounted.current) setError(cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string' ? cause.code : 'APP-REQUEST-FAILED');
  }, []);
  const load = useCallback(async () => {
    if (!user || !mounted.current) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/community/moderation', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw body;
      const data = Queue.parse(body);
      if (mounted.current) setReports(data.reports);
    } catch (cause) { failure(cause); }
    finally { if (mounted.current) setLoading(false); }
  }, [user, failure]);
  useEffect(() => { void load(); }, [load]);
  const act = async (reportId: string, action: 'hide' | 'restore' | 'dismiss') => {
    if (!user) return;
    const input = { reportId, action, reason: reason.trim() };
    const signature = JSON.stringify(input);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    const result = await mutation.run(() => communityRequest(user, '/api/community/moderation', { ...input, requestId: pending.current!.id }), failure);
    if (result.ok) { pending.current = null; setReason(''); await load(); }
  };
  return <main className="mx-auto min-h-screen max-w-4xl space-y-5 px-4 py-10 md:px-8">
    <Link href="/community" className="underline">{publicMessages[lang].nav.community}</Link>
    <h1 className="service-heading text-3xl">{lang === 'vi' ? 'Hàng đợi kiểm duyệt' : 'Moderation queue'}</h1>
    <p>{lang === 'vi' ? 'Chỉ người có quyền moderator do quản trị viên cấp mới được truy cập. Mỗi lượt tối đa 50 báo cáo cũ nhất đang mở/đã ẩn; xử lý rồi tải tiếp. Có thể hoàn tác ẩn nếu tác giả chưa xóa nội dung.' : 'Access requires an administrator-assigned moderator role. Each load shows up to 50 oldest open/hidden reports; process and reload for more. Hiding is reversible unless the author has deleted the content.'}</p>
    {!user ? <Link href="/login" className="service-link">{publicMessages[lang].nav.signIn}</Link> : <>
      <Button onClick={load} disabled={loading || mutation.pending}>{loading ? '…' : lang === 'vi' ? 'Tải lại' : 'Reload'}</Button>
      {error && <p role="alert">{translatedError(error, lang)}</p>}
      <label className="block" htmlFor="moderation-reason">{lang === 'vi' ? 'Lý do quyết định (5–2000 ký tự)' : 'Decision reason (5–2000 characters)'}</label>
      <Textarea id="moderation-reason" maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} />
      {!loading && !error && !reports.length && <p>{lang === 'vi' ? 'Không có báo cáo trong hàng đợi.' : 'No reports in this queue.'}</p>}
      {reports.map(report => <article key={report.id} className="service-surface space-y-4">
        <h2 className="font-bold">{report.target.kind}: {report.target.id}</h2>
        <p>{report.reason}</p><p className="whitespace-pre-wrap break-words">{report.preview}</p>
        <p>{report.hidden ? lang === 'vi' ? 'Nội dung đang ẩn' : 'Content hidden' : lang === 'vi' ? 'Nội dung không bị ẩn bởi hệ thống kiểm duyệt' : 'Content not currently hidden by moderation'}</p>
        <div className="flex flex-wrap gap-3">
          {report.status === 'open' && <><Button disabled={mutation.pending || reason.trim().length < 5 || !report.exists} onClick={() => act(report.id, 'hide')}>{lang === 'vi' ? 'Ẩn' : 'Hide'}</Button><Button variant="outline" disabled={mutation.pending || reason.trim().length < 5} onClick={() => act(report.id, 'dismiss')}>{lang === 'vi' ? 'Không xử lý' : 'Dismiss'}</Button></>}
          {report.hidden && <Button disabled={mutation.pending || reason.trim().length < 5} onClick={() => act(report.id, 'restore')}>{lang === 'vi' ? 'Khôi phục' : 'Restore'}</Button>}
        </div>
      </article>)}
    </>}
  </main>;
}
