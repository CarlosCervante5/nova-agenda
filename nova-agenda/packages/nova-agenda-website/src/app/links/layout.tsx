import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nova Agenda — Enlaces',
  description: 'Gestión de citas, reservas y fidelidad para tu negocio. Comienza gratis.',
  openGraph: {
    title: 'Nova Agenda — Gestión de citas y reservas',
    description: 'Gestión de citas, reservas y fidelidad para tu negocio. Comienza gratis.',
    type: 'website',
  },
};

export default function LinksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
