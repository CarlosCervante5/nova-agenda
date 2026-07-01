import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nova Agenda - Multi-Tenant Booking Platform',
  description: 'The all-in-one platform designed for premium salons and clinics. Manage appointments, clients, and growth with effortless grace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light scroll-smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
