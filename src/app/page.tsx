import { HomeEntry } from '@/components/home-entry';
import { PublicIntro } from '@/components/public-intro';

/** Useful public HTML without using the introduction as an Auth/loading screen. */
export default function Home() {
  return <><HomeEntry /><noscript><PublicIntro /></noscript></>;
}
