import type { Language } from '../types';

/** Locale-independent brand/social identifiers; visible copy uses publicMessages. */
export const publicCopy = {
  brand: 'Shark Empti', notFound: '404 · Shark Empti',
  social: { features: 'Quizzes · Practice · Flashcards', description: 'AI-assisted personal learning support' },
} as const;

export const publicMessages = {
  en: {
    nav: { label: 'Service information', home: 'Home', signIn: 'Sign in', about: 'About us', privacy: 'Privacy', cookies: 'Cookies & storage', terms: 'Terms of use', community: 'Community guidelines', contact: 'Contact' },
    eyebrow: 'Learn with purpose',
    title: 'Train smarter. Learn better.',
    intro: 'Turn a learning goal into questions, understand your answers and choose what to practise next. Your learning record brings those steps together.',
    limits: 'AI feedback and optional camera estimates are experimental study aids. They do not establish ability, attention or a diagnosis.',
    start: 'Start learning', explore: 'Explore Shark Empti',
    footer: 'Learning, one thoughtful step at a time.',
    language: 'Language', theme: 'Toggle theme', loading: 'Preparing your learning space…',
    retry: 'Try again', stalled: 'This is taking longer than expected. Check your connection and try again.',
    pageContents: 'On this page', back: 'Back to learning', contact: 'Contact the operator',
    operator: 'Operator', email: 'Email', moderation: 'Moderation console',
    signOut: 'Sign out', receipt: 'Read-only deletion receipt', formerMember: 'Former member',
    age: 'I confirm that I am at least 16 and have read the Terms of use and Privacy policy.',
    ageRequired: 'Confirm the age requirement and service information before continuing.',
    policyVersion: 'Service information · version 2',
    notFoundTitle: 'Page not found', notFoundBody: 'This address may have changed or no longer exists. Return home or read about the service.',
  },
  vi: {
    nav: { label: 'Thông tin dịch vụ', home: 'Trang chủ', signIn: 'Đăng nhập', about: 'Giới thiệu', privacy: 'Quyền riêng tư', cookies: 'Cookie và lưu trữ', terms: 'Điều khoản sử dụng', community: 'Hướng dẫn cộng đồng', contact: 'Liên hệ' },
    eyebrow: 'Học tập có định hướng',
    title: 'Học thông minh. Tiến bộ mỗi ngày.',
    intro: 'Biến mục tiêu học tập thành câu hỏi, hiểu câu trả lời của mình và chọn nội dung cần luyện tiếp. Lịch sử học tập kết nối các bước đó thành một hành trình.',
    limits: 'Phản hồi AI và ước lượng camera là công cụ học tập thử nghiệm, không xác định năng lực, sự chú ý hay đưa ra chẩn đoán.',
    start: 'Bắt đầu học', explore: 'Khám phá Shark Empti',
    footer: 'Tiến bộ từ từng bước học tập có suy nghĩ.',
    language: 'Ngôn ngữ', theme: 'Đổi giao diện sáng tối', loading: 'Đang chuẩn bị không gian học tập…',
    retry: 'Thử lại', stalled: 'Thời gian tải đang lâu hơn dự kiến. Hãy kiểm tra kết nối và thử lại.',
    pageContents: 'Nội dung trang', back: 'Trở về học tập', contact: 'Liên hệ người vận hành',
    operator: 'Người vận hành', email: 'Email', moderation: 'Bảng điều khiển kiểm duyệt',
    signOut: 'Đăng xuất', receipt: 'Biên nhận xóa chỉ đọc', formerMember: 'Thành viên đã xóa tài khoản',
    age: 'Tôi xác nhận mình từ 16 tuổi và đã đọc Điều khoản sử dụng cùng Chính sách quyền riêng tư.',
    ageRequired: 'Hãy xác nhận điều kiện tuổi và thông tin dịch vụ trước khi tiếp tục.',
    policyVersion: 'Thông tin dịch vụ · phiên bản 2',
    notFoundTitle: 'Không tìm thấy trang', notFoundBody: 'Đường dẫn có thể đã đổi hoặc không còn tồn tại. Bạn có thể về trang chủ hoặc đọc phần giới thiệu dịch vụ.',
  },
} satisfies Record<Language, Record<string, unknown>>;

/** Only the service's anonymous identity is translated; user-written names stay intact. */
export function publicAuthorName(lang: Language, authorId: string, name: string): string {
  return authorId === '__deleted__' ? publicMessages[lang].formerMember : name;
}
