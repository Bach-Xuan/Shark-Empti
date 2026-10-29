import { ServiceInformation } from '@/components/service-information';
import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Privacy and account data' };
export default function Privacy() { return <ServiceInformation section="privacy" />; }
