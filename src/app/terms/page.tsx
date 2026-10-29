import { ServiceInformation } from '@/components/service-information';
import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Service terms' };
export default function Terms() { return <ServiceInformation section="terms" />; }
