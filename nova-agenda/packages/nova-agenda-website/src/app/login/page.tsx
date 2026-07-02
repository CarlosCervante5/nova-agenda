import { redirect } from 'next/navigation';
import { getAdminBaseUrl } from '@/lib/urls';

export default function LoginRedirectPage() {
  redirect(`${getAdminBaseUrl()}/login`);
}
