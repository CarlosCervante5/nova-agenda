import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Book Appointment',
  description: 'Schedule your appointment online',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
