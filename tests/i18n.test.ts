import { common } from '@/lib/i18n/common';
import { errorMessages } from '@/lib/i18n/errors';
import { uiMessages } from '@/lib/i18n/ui';
import { translations } from '@/lib/translations';
import { expect,it } from 'vitest';
for (const [name, catalog] of Object.entries({ app: translations, common, errors: errorMessages, ui: uiMessages })) {
  it(`${name} has matching English/Vietnamese keys and interpolation parameters`, () => {
    expect(Object.keys(catalog.vi).sort()).toEqual(Object.keys(catalog.en).sort());
    const vi = catalog.vi as Record<string, unknown>;
    for (const [key, value] of Object.entries(catalog.en)) {
      expect(String(vi[key]).trim().length).toBeGreaterThan(0);
      const parameters = (text: unknown) => [...String(text).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      expect(parameters(vi[key])).toEqual(parameters(value));
    }
  });
}
