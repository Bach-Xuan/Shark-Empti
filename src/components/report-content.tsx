'use client';
import { useRef, useState } from 'react';
import { useUser } from '@/firebase';
import { communityRequest } from '@/lib/forum-client';
import type { ReportTarget } from '@/lib/community-moderation';
import { useMutation } from '@/hooks/use-mutation';
import { getAiError } from '@/lib/ai-error-message';
import { showErrorToast } from '@/lib/error-toast';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';

export function ReportContent({ target, lang }: { target: ReportTarget; lang: 'en' | 'vi' }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const mutation = useMutation();
  const submit = async () => {
    if (!user) return;
    const input = { target, reason: reason.trim() };
    const signature = JSON.stringify(input);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    const result = await mutation.run(() => communityRequest(user, '/api/community/reports', { ...input, requestId: pending.current!.id }), error => showErrorToast(getAiError(error), lang));
    if (result.ok) { pending.current = null; setSent(true); setReason(''); }
  };
  return <span onClick={event => event.stopPropagation()}>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm">{lang === 'vi' ? 'Báo cáo' : 'Report'}</Button></DialogTrigger>
      <DialogContent><DialogHeader>
        <DialogTitle>{lang === 'vi' ? 'Báo cáo nội dung' : 'Report content'}</DialogTitle>
        <DialogDescription>{lang === 'vi' ? 'Không thêm thông tin nhạy cảm. Báo cáo được lưu để người kiểm duyệt có quyền xem xét; chưa cam kết thời gian phản hồi.' : 'Do not include sensitive information. Reports are saved for authorized moderators; a response time is not guaranteed.'}</DialogDescription>
      </DialogHeader>
        {!user ? <a href="/login" className="underline">{lang === 'vi' ? 'Đăng nhập để báo cáo' : 'Sign in to report'}</a> : sent ? <p role="status">{lang === 'vi' ? 'Đã lưu báo cáo.' : 'Report saved.'}</p> : <>
          <label htmlFor={`report-${target.kind}-${target.id}`}>{lang === 'vi' ? 'Lý do (5–2000 ký tự)' : 'Reason (5–2000 characters)'}</label>
          <Textarea id={`report-${target.kind}-${target.id}`} value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} />
          <Button onClick={submit} disabled={mutation.pending || reason.trim().length < 5}>{lang === 'vi' ? 'Gửi báo cáo' : 'Submit report'}</Button>
        </>}
      </DialogContent>
    </Dialog>
  </span>;
}
