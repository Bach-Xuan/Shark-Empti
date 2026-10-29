import { ImageResponse } from 'next/og';
import { publicCopy } from '@/lib/i18n/public';

export const alt = 'Shark Empti — quizzes, practice and personal learning support';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function SocialImage() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', background: '#fff8f0', color: '#713e15', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80 }}>
    <div style={{ fontSize: 88, fontWeight: 700 }}>{publicCopy.brand}</div>
    <div style={{ fontSize: 38, marginTop: 32 }}>{publicCopy.social.features}</div>
    <div style={{ fontSize: 28, marginTop: 24 }}>{publicCopy.social.description}</div>
  </div>, size);
}
