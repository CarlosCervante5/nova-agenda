'use client';

import { AuthProvider } from '@/lib/auth';

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
