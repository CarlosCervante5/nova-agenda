'use client';

import { useState } from 'react';

const POLICIES = [
  {
    title: 'Cancelación y créditos',
    body: 'Si cancelas con 3 horas o más de anticipación, recuperas el crédito de esa clase. Con menos de 3 horas, o si no te presentas, pierdes la clase. No hay reembolso de dinero.',
  },
  {
    title: 'Cambio de horario',
    body: 'Puedes cambiarte a otra clase con al menos 8 horas de anticipación, sujeto a cupo.',
  },
  {
    title: 'Vigencia del mes',
    body: 'Cada membresía o clase suelta vigila el mismo mes en que se compró. Los créditos no se pasan al mes siguiente.',
  },
  {
    title: 'No transferible',
    body: 'La membresía, los créditos y las reservas son personales. No se pueden prestar ni transferir a otra persona.',
  },
  {
    title: 'Clase de prueba',
    body: 'La clase de prueba ($90 con código) es una sola vez por alumna. Después aplica membresía o clase suelta.',
  },
  {
    title: 'Lista de espera',
    body: 'Si la clase se llena, puedes anotarte. Si se libera un lugar y tienes crédito vigente, entras automáticamente y te avisamos por WhatsApp.',
  },
  {
    title: 'Tolerancia y material',
    body: 'Hay 10 minutos de tolerancia. Trae agua, toalla y calcetines antiderrapantes (algunos planes los incluyen).',
  },
  {
    title: 'Salud',
    body: 'Informa en recepción si tienes lesión, estás embarazada o cualquier condición que debamos cuidar durante la clase.',
  },
];

export default function StudioPolicies({ primaryColor }: { primaryColor: string }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {POLICIES.map((policy, index) => {
        const isOpen = open === index;
        return (
          <div key={policy.title} className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : index)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="font-label-md text-on-surface">{policy.title}</span>
              <span className="material-symbols-outlined text-on-surface-variant">
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {isOpen && (
              <p className="px-4 pb-4 font-body-sm text-on-surface-variant leading-relaxed">
                {policy.body}
              </p>
            )}
          </div>
        );
      })}
      <p className="text-xs text-on-surface-variant pt-2" style={{ color: primaryColor }}>
        Al reservar aceptas estas políticas del estudio.
      </p>
    </div>
  );
}
