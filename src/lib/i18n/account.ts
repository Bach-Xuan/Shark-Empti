export const accountMessages = {
  en: {
    title: 'Your learning data', download: 'Download learning data', next: 'Download next part',
    scope: 'Downloads cover your profile/Auth identity and known private history, notes, activity, flashcards and practice collections. They are live paged data, not an atomic backup or a complete community/AI/account export. Keep every part; only the last part is marked complete.',
    request: 'Request complete export', deletion: 'Request deletion review',
    warning: 'No real operator/contact is configured yet. Requests are saved privately for operator review; they do not delete your account or guarantee fulfilment/response time. Avoid storing sensitive personal information until the service is operationally ready.',
    confirm: 'Save a deletion-review request? No data or account will be deleted automatically.',
    saved: 'Request saved; awaiting a configured operator. No deletion has occurred.',
    part: 'A partial file was downloaded. Download the next part to continue.', done: 'All supported learning datasets were downloaded. Other account/community/AI records require a complete export request.',
  },
  vi: {
    title: 'Dữ liệu học tập của bạn', download: 'Tải dữ liệu học tập', next: 'Tải phần tiếp theo',
    scope: 'Bản tải gồm hồ sơ/danh tính Auth và các bộ sưu tập riêng đã biết: lịch sử, ghi chú, hoạt động, flashcard, luyện tập. Dữ liệu được đọc theo trang, không phải backup nhất quán hay bản đầy đủ của cộng đồng/AI/tài khoản. Giữ mọi phần; chỉ phần cuối mới đánh dấu hoàn tất.',
    request: 'Yêu cầu bản xuất đầy đủ', deletion: 'Yêu cầu xem xét xóa',
    warning: 'Chưa cấu hình người vận hành/liên hệ thật. Yêu cầu được lưu riêng để chờ xử lý, không tự xóa tài khoản và không cam kết thời hạn phản hồi/hoàn tất. Tránh lưu thông tin nhạy cảm cho đến khi dịch vụ sẵn sàng vận hành.',
    confirm: 'Lưu yêu cầu xem xét xóa? Không có dữ liệu hay tài khoản nào bị xóa tự động.',
    saved: 'Đã lưu yêu cầu, đang chờ người vận hành được cấu hình. Chưa xóa dữ liệu.',
    part: 'Đã tải một phần. Hãy tải phần tiếp theo để tiếp tục.', done: 'Đã tải các bộ dữ liệu học tập được hỗ trợ. Dữ liệu tài khoản/cộng đồng/AI khác cần yêu cầu bản xuất đầy đủ.',
  },
} as const;
