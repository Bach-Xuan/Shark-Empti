type SupportedLanguage = 'en' | 'vi';

export function getAiErrorMessage(
  error: unknown,
  language: SupportedLanguage
): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('openrouter_api_key')) {
    return language === 'vi'
      ? 'THIẾU CẤU HÌNH OPENROUTER. VUI LÒNG KIỂM TRA FILE .ENV.'
      : 'OPENROUTER IS NOT CONFIGURED. PLEASE CHECK THE .ENV FILE.';
  }

  if (
    normalized.includes('premature close') ||
    normalized.includes('connection failed') ||
    normalized.includes('fetch failed') ||
    normalized.includes('econnreset')
  ) {
    return language === 'vi'
      ? 'KẾT NỐI OPENROUTER BỊ GIÁN ĐOẠN. VUI LÒNG THỬ LẠI.'
      : 'THE OPENROUTER CONNECTION WAS INTERRUPTED. PLEASE TRY AGAIN.';
  }

  if (
    normalized.includes('no output') ||
    normalized.includes('invalid output') ||
    normalized.includes('response_format') ||
    normalized.includes('json schema')
  ) {
    return language === 'vi'
      ? 'MODEL KHÔNG TRẢ VỀ DỮ LIỆU ĐÚNG ĐỊNH DẠNG. VUI LÒNG THỬ LẠI.'
      : 'THE MODEL RETURNED AN INVALID RESPONSE FORMAT. PLEASE TRY AGAIN.';
  }

  return language === 'vi'
    ? 'KHÔNG THỂ HOÀN TẤT YÊU CẦU AI. VUI LÒNG THỬ LẠI.'
    : 'THE AI REQUEST COULD NOT BE COMPLETED. PLEASE TRY AGAIN.';
}
