'use client';
import Link from 'next/link';
import { publicCopy as copy } from '@/lib/i18n/public';
import { useAppPreferences } from './app-preferences';
import { SITE_INFO } from '@/lib/site-info';

const information = {
  en: {
    privacy: { title: 'Privacy and account data', paragraphs: [
      'Google sign-in uses Firebase Authentication. Email stays in Auth. Known-UID public profile lookup contains display name, photo, biography and symbolic coins; learning records, notes and activity are owner-scoped.',
      'Learning/chat inputs are sent through the server to OpenRouter and the selected model provider. Do not submit sensitive personal data. The optional camera processes frames locally; the application does not upload those frames for inference.',
      'Forum/Arena are publicly readable but marked noindex. This is a crawler instruction, not confidentiality. Learning/community data has no automatic expiry. AI records carry a 24-hour TTL and operation receipts a seven-day TTL; deletion depends on deployed policies and is asynchronous. Browser storage retains language, theme and account-scoped roadmap preferences.',
      'Same-tab learning drafts use account-scoped sessionStorage with a 24-hour logical inactivity expiry; expired/invalid drafts are removed when accessed, other-owner drafts on Auth changes and all learning drafts on sign-out. Storage is not encrypted by this application or synchronized across devices; browser policy can prevent recovery.',
      'Profile can download supported private learning datasets in paged JSON parts, including selected Auth identity fields but never credentials. This is not a complete account/community/AI export. Complete-export or deletion-review requests are stored privately for operator review; they do not automatically delete anything or guarantee fulfilment. A real operator/contact and processing workflow are still required.',
    ] },
    terms: { title: 'Service terms — configuration draft', paragraphs: [
      'This is an implementation draft, not operator-approved legal terms. Operator identity, support contact, intended audience and retention policy must be finalized before public release.',
      'AI feedback, cognitive labels and camera estimates may be wrong. They are study aids, not validated assessments or professional advice. Review important answers independently; do not use these estimates for consequential grading or monitoring.',
      'Shark Coins are symbolic participation scores, with no payment, cash value or redemption promise. Do not automate submissions, exploit retries, impersonate others or share content without permission.',
    ] },
    community: { title: 'Community guidelines', paragraphs: [
      'Keep discussion constructive and relevant to learning. No personal information, harassment, impersonation, spam or content shared without permission.',
      'Forum/Arena remain public but are not intended for search indexing. Noindex is not a privacy guarantee. Avoid putting private information in posts, challenges or answers.',
      'A moderation owner and real support contact must be configured before moderation or response-time promises can be made. The placeholder below is not a working reporting inbox.',
    ] },
  },
  vi: {
    privacy: { title: 'Quyền riêng tư và dữ liệu tài khoản', paragraphs: [
      'Đăng nhập Google dùng Firebase Authentication. Email ở Auth. Tra cứu hồ sơ bằng UID chỉ gồm tên, ảnh, giới thiệu và coin tượng trưng; dữ liệu học tập, ghi chú và hoạt động cá nhân được giới hạn theo chủ tài khoản.',
      'Nội dung học tập/chat được gửi qua server đến OpenRouter và nhà cung cấp mô hình được chọn. Không nhập dữ liệu cá nhân nhạy cảm. Camera là tùy chọn, xử lý khung hình trong trình duyệt; ứng dụng không tải khung hình lên để suy luận.',
      'Forum/Arena được đọc công khai nhưng có noindex. Đây là chỉ dẫn crawler, không phải bảo mật. Dữ liệu học tập/cộng đồng chưa tự hết hạn. Bản ghi AI có TTL 24 giờ, receipt thao tác có TTL bảy ngày; xóa phụ thuộc chính sách đã triển khai và diễn ra bất đồng bộ. Trình duyệt lưu ngôn ngữ, giao diện và tùy chọn lộ trình theo tài khoản.',
      'Bản nháp cùng tab dùng sessionStorage riêng theo tài khoản, hết hạn logic sau 24 giờ không hoạt động; bản hết hạn/hỏng được dọn khi truy cập, bản của tài khoản khác khi Auth đổi và mọi bản nháp khi đăng xuất. Ứng dụng không mã hóa kho này hay đồng bộ thiết bị; chính sách trình duyệt có thể khiến không khôi phục được.',
      'Hồ sơ có thể tải các bộ dữ liệu học tập riêng được hỗ trợ theo từng phần JSON, kèm danh tính Auth chọn lọc nhưng không gồm thông tin xác thực. Đây không phải bản đầy đủ của tài khoản/cộng đồng/AI. Yêu cầu xuất đầy đủ hoặc xem xét xóa được lưu riêng để người vận hành xử lý, không tự xóa và không cam kết hoàn tất. Vẫn cần người phụ trách/liên hệ thật và quy trình xử lý.',
    ] },
    terms: { title: 'Điều khoản dịch vụ — bản nháp cấu hình', paragraphs: [
      'Đây là bản nháp triển khai, chưa phải điều khoản pháp lý đã được đơn vị vận hành duyệt. Cần chốt đơn vị vận hành, đầu mối hỗ trợ, đối tượng sử dụng và chính sách lưu trữ trước khi phát hành công khai.',
      'AI, nhãn năng lực và ước lượng camera có thể sai. Đây chỉ là hỗ trợ học tập, không phải đánh giá đã kiểm định hay tư vấn chuyên môn. Tự kiểm chứng câu trả lời quan trọng; không dùng các ước lượng để chấm điểm hay giám sát có hệ quả đáng kể.',
      'Shark Coins là điểm tham gia tượng trưng, không có giá trị thanh toán, tiền mặt hay cam kết quy đổi. Không tự động hóa lượt nộp, khai thác retry, mạo danh hoặc chia sẻ nội dung không được phép.',
    ] },
    community: { title: 'Hướng dẫn cộng đồng', paragraphs: [
      'Trao đổi xây dựng và liên quan đến học tập. Không đăng thông tin cá nhân, quấy rối, mạo danh, spam hoặc nội dung không được phép.',
      'Forum/Arena vẫn công khai nhưng không dành cho công cụ tìm kiếm index. Noindex không bảo đảm quyền riêng tư. Không đưa thông tin riêng tư vào bài viết, thử thách hay câu trả lời.',
      'Cần cấu hình người phụ trách kiểm duyệt và đầu mối hỗ trợ thật trước khi cam kết kiểm duyệt hay thời gian phản hồi. Placeholder bên dưới không phải hộp thư tiếp nhận đang hoạt động.',
    ] },
  },
};

export function ServiceInformation({ section }: { section: 'privacy' | 'terms' | 'community' }) {
  const { lang, setLang } = useAppPreferences();
  const content = information[lang][section];
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-6">
    <nav aria-label={lang === 'vi' ? 'Thông tin dịch vụ' : 'Service information'} className="flex flex-wrap gap-4 underline">
      <Link href="/">{copy.nav.home}</Link><Link href="/about">{copy.nav.about}</Link><Link href="/privacy">{copy.nav.privacy}</Link><Link href="/terms">{copy.nav.terms}</Link><Link href="/community">{copy.nav.community}</Link>
    </nav>
    <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}>{lang === 'vi' ? 'Read in English' : 'Đọc tiếng Việt'}</button>
    <h1 className="text-3xl font-bold">{content.title}</h1>
    {content.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    {section === 'community' && <p><Link className="underline" href="/moderation">{lang === 'vi' ? 'Bảng điều khiển cho người được cấp quyền kiểm duyệt' : 'Console for authorized moderators'}</Link></p>}
    <aside role="status" className="space-y-2 rounded-xl border p-4">
      <p>{SITE_INFO.operator}</p><p>{SITE_INFO.supportEmail}</p>
      <p>{lang === 'vi' ? 'Thông tin mẫu chưa cấu hình. Không gửi dữ liệu cá nhân đến địa chỉ placeholder.' : 'Unconfigured placeholder. Do not send personal data to this placeholder address.'}</p>
    </aside>
  </main>;
}
