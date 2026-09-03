export const errorMessages = {
  en: {
    data: 'Some saved data could not be read. Please contact the administrator.',
    generic: 'Something went wrong. Please try again.', configuration: 'This service is not configured. Please contact the administrator.',
    network: 'Connection interrupted. Check your network and try again.', permission: 'You do not have permission to perform this action.',
    rate: 'The AI service is busy. Please try again shortly.', timeout: 'The request timed out. Please try again.',
    response: 'The AI response could not be read. Please try again.', authentication: 'Please sign in again to continue.',
    input: 'Please check the information you entered.', render: 'Unable to display this content.', retry: 'Retry', home: 'Home',
  },
  vi: {
    data: 'Không thể đọc một phần dữ liệu đã lưu. Vui lòng liên hệ quản trị viên.',
    generic: 'Đã xảy ra lỗi. Vui lòng thử lại.', configuration: 'Dịch vụ chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
    network: 'Kết nối bị gián đoạn. Kiểm tra mạng và thử lại.', permission: 'Bạn không có quyền thực hiện thao tác này.',
    rate: 'Dịch vụ AI đang bận. Vui lòng thử lại sau ít phút.', timeout: 'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
    response: 'Không thể đọc phản hồi AI. Vui lòng thử lại.', authentication: 'Vui lòng đăng nhập lại để tiếp tục.',
    input: 'Vui lòng kiểm tra thông tin đã nhập.', render: 'Không thể hiển thị nội dung.', retry: 'Thử lại', home: 'Trang chủ',
  },
} satisfies Record<'en' | 'vi', Record<string, string>>;
export function translatedError(code: string, language: 'en' | 'vi') {
  const t = errorMessages[language];
  if (/DATA-INVALID/.test(code)) return t.data;
  if (/CONFIG/.test(code)) return t.configuration;
  if (/PERMISSION|FORBIDDEN/.test(code)) return t.permission;
  if (/AUTH/.test(code)) return t.authentication;
  if (/429|RATE/.test(code)) return t.rate;
  if (/TIMEOUT/.test(code)) return t.timeout;
  if (/TRANSPORT|NETWORK|UNAVAILABLE/.test(code)) return t.network;
  if (/INVALID-RESPONSE/.test(code)) return t.response;
  if (/INVALID-INPUT/.test(code)) return t.input;
  return t.generic;
}
