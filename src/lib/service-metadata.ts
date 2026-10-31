import 'server-only';
import { cookies } from 'next/headers';
import { PREFERENCE_COOKIE, parsePreferences } from './preferences';
import { serviceMessages, type ServicePage } from './i18n/service';
import { privateMetadata } from './site-metadata';

export async function serviceMetadata(section: ServicePage) {
  const lang = parsePreferences((await cookies()).get(PREFERENCE_COOKIE)?.value)?.lang ?? 'en';
  const copy = serviceMessages[lang][section];
  return { ...privateMetadata, title: copy.title, description: copy.intro };
}
