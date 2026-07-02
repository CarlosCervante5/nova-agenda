import { redirect } from 'next/navigation';
import { getAdminBaseUrl } from '@/lib/urls';

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function RegisterRedirectPage({ searchParams }: Props) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }

  const qs = params.toString();
  const target = `${getAdminBaseUrl()}/register${qs ? `?${qs}` : ''}`;
  redirect(target);
}
