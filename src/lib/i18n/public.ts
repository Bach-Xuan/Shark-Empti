/** Bilingual server-rendered copy; public HTML remains useful without hydration. */
export const publicCopy = {
  brand: 'Shark Empti', notFound: '404 · Shark Empti',
  nav: { label: 'Service information / Thông tin dịch vụ', home: 'Home / Trang chủ', signIn: 'Sign in / Đăng nhập', about: 'About / Giới thiệu', privacy: 'Privacy / Dữ liệu', terms: 'Terms / Điều khoản', community: 'Community / Cộng đồng' },
  intro: {
    en: 'Study with AI-assisted quizzes, practice, flashcards and personal learning records.',
    vi: 'Hỗ trợ học tập qua câu hỏi, luyện tập, thẻ ghi nhớ và lịch sử học tập cá nhân.',
    limits: 'AI feedback and optional on-device camera scores are estimates, not verified assessments of ability or attention.',
  },
  about: {
    title: 'About Shark Empti / Giới thiệu',
    en: 'Shark Empti offers AI-assisted quizzes, flashcards, practice, personal history and public peer-learning spaces.',
    vi: 'Nền tảng hỗ trợ câu hỏi học tập, thẻ ghi nhớ, luyện tập, lịch sử cá nhân và trao đổi cộng đồng.',
    limitsEn: 'AI feedback may be wrong. Cognitive charts and optional camera-model estimates are exploratory learning aids, not diagnoses, validated ability scores or reliable person/attention detection.',
    limitsVi: 'AI có thể sai. Biểu đồ và ước lượng từ camera chỉ là công cụ tham khảo, không phải đánh giá năng lực hay sự tập trung đã được kiểm định.',
  },
  social: { features: 'Quizzes · Practice · Flashcards', description: 'AI-assisted personal learning support' },
} as const;
