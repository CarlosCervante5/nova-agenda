import { getClientInfo, getLoyaltyProgram } from '@/lib/api';
import BookingPage from './BookingPage';
import { notFound } from 'next/navigation';

export default async function ClientPage({ params }: { params: { clientSlug: string } }) {
  const client = await getClientInfo(params.clientSlug);

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Negocio No Encontrado</h1>
          <p className="text-gray-600">Esta página de reservas no existe.</p>
        </div>
      </div>
    );
  }

  if (client.bookingDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Página No Disponible</h1>
          <p className="text-gray-600 mb-6">Este negocio no tiene página de reservas activa. Contacta al negocio para más información.</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-amber-700 text-sm font-medium">Plan: {client.plan || 'Gratuito'}</span>
          </div>
        </div>
      </div>
    );
  }

  const loyaltyProgram = await getLoyaltyProgram(client.id);

  return <BookingPage client={client} clientSlug={params.clientSlug} loyaltyProgram={loyaltyProgram} />;
}
