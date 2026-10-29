import { ServiceInformation } from '@/components/service-information';
import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Community guidelines' };
export default function Community() { return <ServiceInformation section="community" />; }
