'use client';

import { AuthProvider } from '@/lib/auth';
import LoginPage from './page';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
