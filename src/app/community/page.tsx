import { ServiceInformation } from '@/components/service-information';
import { serviceMetadata } from '@/lib/service-metadata';
export const generateMetadata = () => serviceMetadata('community');
export default function Page() { return <ServiceInformation section="community" />; }
