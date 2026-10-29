import type { Language } from '@/lib/types';
export function DraftNotice({ restored, available, lang }: { restored: boolean; available: boolean; lang: Language }) {
  if (!available) return <p role="alert" className="rounded-xl border p-3">{lang === 'vi' ? 'Trình duyệt không lưu được bản nháp. Đừng đóng tab nếu bạn muốn giữ tiến độ.' : 'The browser could not save a draft. Keep this tab open to preserve your progress.'}</p>;
  return <p role="status" className="text-sm text-muted-foreground">{restored ? lang === 'vi' ? 'Đã khôi phục tiến độ trong tab này.' : 'Progress restored in this tab.' : lang === 'vi' ? 'Bản nháp riêng cho tài khoản được lưu trong tab này tối đa 24 giờ không hoạt động; không đồng bộ sang thiết bị khác.' : 'An account-scoped draft is kept in this tab for up to 24 hours of inactivity; it does not sync across devices.'}</p>;
}
