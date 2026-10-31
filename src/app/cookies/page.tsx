import { ServiceInformation } from '@/components/service-information';
import { serviceMetadata } from '@/lib/service-metadata';
export const generateMetadata = () => serviceMetadata('cookies');
export default function Page() { return <ServiceInformation section="cookies" />; }
