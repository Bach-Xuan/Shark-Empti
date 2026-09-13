import { asAiResult,createAppError,getAiAppError,OpenRouterProviderError } from '@/lib/app-error';
import { describe,expect,it } from 'vitest';

describe('AI error contract', () => {
  it('preserves a safe provider error code and values', () => {
    const providerError = new OpenRouterProviderError(createAppError(
      'AI-UPSTREAM-502',
      'OpenRouter could not complete the AI request.',
      { httpStatus: 200, providerCode: '502', provider: 'Nvidia' }
    ));
    expect(getAiAppError(providerError)).toEqual({
      code: 'AI-UPSTREAM-502',
      message: 'OpenRouter could not complete the AI request.',
      values: { httpStatus: 200, providerCode: '502', provider: 'Nvidia' },
    });
  });

  it('returns a serializable failure rather than throwing from an action', async () => {
    const result = await asAiResult(async () => {
      throw new Error('Premature close');
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'AI-TRANSPORT', message: 'The AI connection was interrupted.', values: {} },
    });
  });

  it('does not include an API key in unknown error values', () => {
    const error = getAiAppError(new Error('provider rejected sk-not-a-real-key'));
    expect(JSON.stringify(error)).not.toContain('sk-not-a-real-key');
  });
});
