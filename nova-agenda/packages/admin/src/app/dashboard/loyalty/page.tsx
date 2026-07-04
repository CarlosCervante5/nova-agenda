'use client';

import { useState, useEffect } from 'react';
import { api, Service } from '@/lib/api';
import { LoyaltyProgram, LoyaltyReward } from './interface';
import { useAuth } from '@/lib/auth';
import LoyaltyCardsPanel from './LoyaltyCardsPanel';

type RewardDraft = {
  name: string;
  description: string;
  stampsRequired: number;
  rewardType: string;
  value: number;
  serviceId: string;
  isActive: boolean;
};

const REWARD_TYPE_OPTIONS = [
  { value: 'PERCENTAGE_DISCOUNT', label: 'Descuento %', hint: 'Ej: 10 = 10% de descuento' },
  { value: 'FIXED_AMOUNT', label: 'Descuento fijo ($)', hint: 'Monto en pesos a descontar' },
  { value: 'FREE_SERVICE', label: 'Servicio gratis', hint: 'Visitas para un servicio sin costo' },
  { value: 'SERVICE_DISCOUNT', label: 'Descuento en servicio ($)', hint: 'Descuento fijo sobre un servicio' },
  { value: 'CUSTOM', label: 'Personalizada', hint: 'Recompensa libre (solo texto)' },
];

function rewardTypeLabel(type: string) {
  return REWARD_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
}

function defaultRewards(cardSize: number): RewardDraft[] {
  return [
    {
      name: 'Descuento del 10%',
      description: 'Descuento en tu próxima visita',
      stampsRequired: Math.max(1, Math.floor(cardSize / 2)),
      rewardType: 'PERCENTAGE_DISCOUNT',
      value: 10,
      serviceId: '',
      isActive: true,
    },
    {
      name: 'Servicio gratis',
      description: 'Un servicio sin costo al completar la tarjeta',
      stampsRequired: cardSize,
      rewardType: 'FREE_SERVICE',
      value: 0,
      serviceId: '',
      isActive: true,
    },
  ];
}

function rewardsToDraft(rewards?: LoyaltyReward[], cardSize = 10): RewardDraft[] {
  if (!rewards?.length) return defaultRewards(cardSize);
  return rewards.map((r) => ({
    name: r.name,
    description: r.description || '',
    stampsRequired: r.stampsRequired,
    rewardType: r.rewardType,
    value: r.value,
    serviceId: r.serviceId || '',
    isActive: r.isActive !== false,
  }));
}

export default function LoyaltyPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientPlan, setClientPlan] = useState('FREE');
  const [loading, setLoading] = useState(true);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<LoyaltyProgram | null>(null);
  const [formData, setFormData] = useState<Partial<LoyaltyProgram>>({});
  const [rewards, setRewards] = useState<RewardDraft[]>(defaultRewards(10));
  const [activeTab, setActiveTab] = useState<'program' | 'cards'>('program');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const [programsData, servicesData, client] = await Promise.all([
        api.getPrograms(),
        api.getServices().catch(() => [] as Service[]),
        user?.clientId ? api.getClient(user.clientId).catch(() => null) : Promise.resolve(null),
      ]);
      setPrograms(programsData);
      setServices(servicesData.filter((s) => s.isActive));
      if (client) setClientPlan(client.plan);
    } catch (err) {
      console.error('Error loading loyalty programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const openProgramForm = (program: LoyaltyProgram | null = null) => {
    setSelectedProgram(program);
    setError('');
    const cardSize = program?.stampsToReward || 10;
    setFormData(
      program || {
        name: '',
        description: '',
        stampsToReward: 10,
        isActive: false,
        stampIcon: 'local_fire_department',
        stampColor: '#2dd4bf',
        backgroundColor: '#ffffff',
        textColor: '#191c1e',
        enableWhatsApp: false,
        welcomeMessage: '¡Bienvenido al programa de fidelidad! Recibirás un sello por cada visita.',
        rewardMessage: '¡Felicitaciones! Has completado tu tarjeta y ganado una recompensa.',
      }
    );
    setRewards(rewardsToDraft(program?.rewards, cardSize));
    setShowProgramForm(true);
  };

  function updateReward(index: number, patch: Partial<RewardDraft>) {
    setRewards((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addReward() {
    const cardSize = formData.stampsToReward || 10;
    setRewards((prev) => [
      ...prev,
      {
        name: '',
        description: '',
        stampsRequired: cardSize,
        rewardType: 'PERCENTAGE_DISCOUNT',
        value: 10,
        serviceId: '',
        isActive: true,
      },
    ]);
  }

  function removeReward(index: number) {
    setRewards((prev) => prev.filter((_, i) => i !== index));
  }

  function buildPayload() {
    const cardSize = Math.max(1, Number(formData.stampsToReward) || 10);
    return {
      ...formData,
      stampsToReward: cardSize,
      clientId: user?.clientId,
      rewards: rewards
        .filter((r) => r.name.trim())
        .map((r, index) => ({
          name: r.name.trim(),
          description: r.description.trim() || undefined,
          stampsRequired: Math.max(1, Number(r.stampsRequired) || cardSize),
          rewardType: r.rewardType,
          value: Number(r.value) || 0,
          serviceId: r.serviceId || undefined,
          isActive: r.isActive,
          sortOrder: index + 1,
        })),
    };
  }

  const handleCreateProgram = async () => {
    try {
      setError('');
      const newProgram = await api.createProgram(buildPayload() as Record<string, unknown>);
      setPrograms([...programs, newProgram]);
      setShowProgramForm(false);
      setFormData({});
      setRewards(defaultRewards(10));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el programa');
    }
  };

  const handleUpdateProgram = async () => {
    try {
      setError('');
      const updatedProgram = await api.updateProgram(
        selectedProgram?.clientId as string,
        buildPayload() as Record<string, unknown>
      );
      setPrograms(programs.map((p) => (p.id === selectedProgram?.id ? updatedProgram : p)));
      setSelectedProgram(null);
      setShowProgramForm(false);
      setFormData({});
      setRewards(defaultRewards(10));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el programa');
    }
  };

  const handleDeleteProgram = async (clientId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este programa de fidelidad?')) return;
    try {
      await api.deleteProgram(clientId);
      setPrograms(programs.filter((p) => p.clientId !== clientId));
    } catch (err) {
      console.error('Error deleting loyalty program:', err);
    }
  };

  const handleToggleActive = async (program: LoyaltyProgram) => {
    try {
      const updated = await api.toggleLoyaltyProgram(program.clientId);
      setPrograms(programs.map((p) => (p.id === program.id ? updated : p)));
    } catch (err) {
      console.error('Error toggling loyalty program:', err);
    }
  };

  const handleSubmitProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (rewards.filter((r) => r.name.trim()).length === 0) {
      setError('Agrega al menos una recompensa (descuento, servicio gratis, etc.)');
      return;
    }
    if (selectedProgram) handleUpdateProgram();
    else handleCreateProgram();
  };

  if (loading) {
    return (
      <div className="space-y-gutter animate-pulse">
        <div className="glass-card rounded-xl h-12" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <div className="glass-card rounded-xl h-64" />
          <div className="glass-card rounded-xl h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Programa de Fidelidad</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Configura cuántas visitas dan descuento, servicio gratis y otras recompensas. 1 sello = 1 visita completada.
          </p>
        </div>
        <button
          onClick={() => openProgramForm()}
          disabled={user?.role !== 'SUPER_ADMIN' && programs.length > 0}
          className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Nuevo Programa
        </button>
      </div>

      {programs.length > 0 && (
        <div className="flex gap-2 border-b border-outline-variant">
          <button
            onClick={() => setActiveTab('program')}
            className={`px-4 py-2 font-label-md text-label-md border-b-2 transition-colors ${
              activeTab === 'program' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
            }`}
          >
            Configuración
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-4 py-2 font-label-md text-label-md border-b-2 transition-colors ${
              activeTab === 'cards' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
            }`}
          >
            Tarjetas de clientes ({programs[0]?._count?.cards || 0})
          </button>
        </div>
      )}

      {activeTab === 'cards' && programs[0] && (
        <LoyaltyCardsPanel
          program={programs[0]}
          clientId={programs[0].clientId}
          clientPlan={clientPlan}
        />
      )}

      {activeTab === 'program' && showProgramForm && (
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg">
            {selectedProgram ? 'Editar Programa' : 'Crear Programa'}
          </h3>

          {error && (
            <div className="mb-lg p-4 rounded-lg bg-error-container text-on-error-container font-body-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmitProgram} className="space-y-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Nombre del Programa</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                  required
                  placeholder="Ej: Tarjeta de Visitas"
                />
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">
                  Visitas para llenar la tarjeta
                </label>
                <input
                  type="number"
                  value={formData.stampsToReward ?? 10}
                  onChange={(e) => {
                    const stampsToReward = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setFormData({ ...formData, stampsToReward });
                  }}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                  min={1}
                  required
                />
                <p className="font-body-sm text-on-surface-variant mt-1">
                  Cada cita completada suma 1 sello / visita. Este número es el tamaño de la tarjeta.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Descripción</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                  rows={2}
                  placeholder="Describe el programa de fidelidad"
                />
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Ícono de Sello</label>
                <select
                  value={formData.stampIcon || 'local_fire_department'}
                  onChange={(e) => setFormData({ ...formData, stampIcon: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                >
                  <option value="local_fire_department">Fuego</option>
                  <option value="star">Estrella</option>
                  <option value="workspace_premium">Premium</option>
                  <option value="card_giftcard">Regalo</option>
                  <option value="favorite">Corazón</option>
                  <option value="loyalty">Fidelidad</option>
                </select>
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Color del Sello</label>
                <input
                  type="color"
                  value={formData.stampColor || '#2dd4bf'}
                  onChange={(e) => setFormData({ ...formData, stampColor: e.target.value })}
                  className="w-full h-12 border border-outline-variant rounded-lg cursor-pointer"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Mensaje de bienvenida</label>
                <input
                  value={formData.welcomeMessage || ''}
                  onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Mensaje al completar tarjeta</label>
                <input
                  value={formData.rewardMessage || ''}
                  onChange={(e) => setFormData({ ...formData, rewardMessage: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Recompensas */}
            <div className="pt-lg border-t border-outline-variant">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-md">
                <div>
                  <h4 className="font-headline-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">card_giftcard</span>
                    Recompensas por visitas
                  </h4>
                  <p className="font-body-sm text-on-surface-variant">
                    Define cuántas visitas se necesitan para cada descuento o servicio gratis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addReward}
                  className="px-md py-2 border border-outline-variant rounded-lg font-label-sm font-bold hover:bg-surface-container-low"
                >
                  + Agregar recompensa
                </button>
              </div>

              <div className="space-y-4">
                {rewards.map((reward, index) => {
                  const typeMeta = REWARD_TYPE_OPTIONS.find((o) => o.value === reward.rewardType);
                  const needsValue =
                    reward.rewardType === 'PERCENTAGE_DISCOUNT' ||
                    reward.rewardType === 'FIXED_AMOUNT' ||
                    reward.rewardType === 'SERVICE_DISCOUNT';
                  const needsService =
                    reward.rewardType === 'FREE_SERVICE' || reward.rewardType === 'SERVICE_DISCOUNT';

                  return (
                    <div
                      key={index}
                      className="p-md rounded-xl border border-outline-variant bg-surface-container-low space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-md text-on-surface">Recompensa {index + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 font-label-sm text-on-surface-variant cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reward.isActive}
                              onChange={(e) => updateReward(index, { isActive: e.target.checked })}
                            />
                            Activa
                          </label>
                          {rewards.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeReward(index)}
                              className="p-1 text-on-surface-variant hover:text-error"
                              aria-label="Eliminar recompensa"
                            >
                              <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-label-sm text-on-surface-variant mb-1 block">Nombre</label>
                          <input
                            value={reward.name}
                            onChange={(e) => updateReward(index, { name: e.target.value })}
                            placeholder="Ej: 10% de descuento"
                            className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
                            required
                          />
                        </div>
                        <div>
                          <label className="font-label-sm text-on-surface-variant mb-1 block">Tipo</label>
                          <select
                            value={reward.rewardType}
                            onChange={(e) => updateReward(index, { rewardType: e.target.value })}
                            className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
                          >
                            {REWARD_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="font-label-sm text-on-surface-variant mb-1 block">
                            Visitas / sellos necesarios
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={reward.stampsRequired}
                            onChange={(e) =>
                              updateReward(index, {
                                stampsRequired: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
                            required
                          />
                          <p className="text-xs text-on-surface-variant mt-1">
                            Tras {reward.stampsRequired} visita{reward.stampsRequired === 1 ? '' : 's'} el cliente desbloquea esta recompensa.
                          </p>
                        </div>
                        {needsValue && (
                          <div>
                            <label className="font-label-sm text-on-surface-variant mb-1 block">
                              {reward.rewardType === 'PERCENTAGE_DISCOUNT' ? 'Porcentaje (%)' : 'Monto ($)'}
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={reward.rewardType === 'PERCENTAGE_DISCOUNT' ? 1 : 0.01}
                              value={reward.value}
                              onChange={(e) =>
                                updateReward(index, { value: parseFloat(e.target.value) || 0 })
                              }
                              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
                            />
                            {typeMeta && (
                              <p className="text-xs text-on-surface-variant mt-1">{typeMeta.hint}</p>
                            )}
                          </div>
                        )}
                        {needsService && (
                          <div className={needsValue ? '' : 'md:col-span-1'}>
                            <label className="font-label-sm text-on-surface-variant mb-1 block">
                              Servicio (opcional)
                            </label>
                            <select
                              value={reward.serviceId}
                              onChange={(e) => updateReward(index, { serviceId: e.target.value })}
                              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
                            >
                              <option value="">Cualquier servicio</option>
                              {services.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <label className="font-label-sm text-on-surface-variant mb-1 block">Descripción</label>
                          <input
                            value={reward.description}
                            onChange={(e) => updateReward(index, { description: e.target.value })}
                            placeholder="Texto que verá el cliente"
                            className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-lg rounded-xl border border-outline-variant bg-surface-container-low">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 mt-0.5 text-primary border-outline-variant rounded focus:ring-0"
                />
                <div>
                  <span className="font-label-md text-label-md text-on-surface block">
                    Activar programa en portal público
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Solo cuando está activo, tus clientes ven fidelidad y acumulan sellos al completar citas.
                  </span>
                </div>
              </label>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.enableWhatsApp}
                onChange={(e) => setFormData({ ...formData, enableWhatsApp: e.target.checked })}
                className="w-5 h-5 text-primary border-outline-variant rounded focus:ring-0"
              />
              <span className="font-label-md text-label-md text-on-surface">
                Activar notificaciones WhatsApp (plan Business)
              </span>
            </label>

            <div className="pt-md flex gap-3">
              <button
                type="submit"
                className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
              >
                {selectedProgram ? 'Guardar cambios' : 'Crear Programa'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProgramForm(false);
                  setSelectedProgram(null);
                  setFormData({});
                  setRewards(defaultRewards(10));
                  setError('');
                }}
                className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'program' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {programs.map((program) => (
            <div
              key={program.id}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-xl">
                <div className="flex items-start justify-between mb-md">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-on-primary"
                    style={{ backgroundColor: program.stampColor }}
                  >
                    <span className="material-symbols-outlined">{program.stampIcon}</span>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      program.isActive
                        ? 'bg-secondary-container/30 text-on-secondary-container'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {program.isActive ? 'Activo' : 'Inactivo'}
                  </div>
                </div>

                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{program.name}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-sm">{program.description}</p>
                <p className="font-body-sm text-body-sm text-on-surface mb-md">
                  Tarjeta de <strong>{program.stampsToReward}</strong> visitas
                </p>

                {program.rewards && program.rewards.length > 0 && (
                  <ul className="mb-md space-y-2">
                    {program.rewards.map((r) => (
                      <li
                        key={r.id}
                        className={`text-xs p-2 rounded-lg border ${
                          r.isActive
                            ? 'border-outline-variant bg-surface-container-low'
                            : 'border-outline-variant/50 opacity-60'
                        }`}
                      >
                        <span className="font-bold text-on-surface">{r.stampsRequired} visitas</span>
                        <span className="text-on-surface-variant"> · {rewardTypeLabel(r.rewardType)}</span>
                        <span className="block text-on-surface mt-0.5">{r.name}</span>
                        {r.rewardType === 'PERCENTAGE_DISCOUNT' && (
                          <span className="text-on-surface-variant">{r.value}% off</span>
                        )}
                        {r.rewardType === 'FIXED_AMOUNT' && (
                          <span className="text-on-surface-variant">${r.value} off</span>
                        )}
                        {r.rewardType === 'FREE_SERVICE' && (
                          <span className="text-on-surface-variant">Servicio gratis</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {!program.isActive && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-md p-3 rounded-lg bg-surface-container-low border border-outline-variant">
                    Inactivo: los clientes no lo ven en el portal hasta que lo actives.
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleActive(program)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      program.isActive
                        ? 'bg-surface-container-high text-on-surface-variant hover:bg-error-container/30 hover:text-error'
                        : 'bg-primary text-on-primary hover:opacity-90'
                    }`}
                  >
                    {program.isActive ? 'Desactivar' : 'Activar en portal'}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {program._count?.cards || 0} tarjetas
                    </span>
                    <button
                      onClick={() => openProgramForm(program)}
                      className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(program.clientId)}
                      className="p-2 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {programs.length === 0 && (
            <div className="col-span-full bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm text-center">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">card_giftcard</span>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">No hay programas de fidelidad</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
                Define visitas para descuentos, servicio gratis y más. El programa queda inactivo hasta que lo actives.
              </p>
              <button
                onClick={() => openProgramForm()}
                className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
              >
                Crear Primer Programa
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
