'use client';

export default function PosPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-surface-container-high rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-primary text-4xl">point_of_sale</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Punto de Venta</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mb-6">
          Estamos trabajando en una sección de POS para gestionar ventas, cobros y pagos desde tu negocio.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-tertiary-container text-on-tertiary-container rounded-full font-label-md text-label-md">
          <span className="material-symbols-outlined text-lg">schedule</span>
          Próximamente
        </div>
      </div>
    </div>
  );
}
