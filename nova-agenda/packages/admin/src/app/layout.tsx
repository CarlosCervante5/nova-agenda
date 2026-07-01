import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nova Agenda - Admin Dashboard',
  description: 'Multi-tenant appointment management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="light">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
