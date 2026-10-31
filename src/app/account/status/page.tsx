import { AccountReceipt } from '@/components/account-receipt';
import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Account status' };
export default function AccountStatusPage() { return <AccountReceipt />; }
