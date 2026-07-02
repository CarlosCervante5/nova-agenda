'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { LoyaltyProgram } from './interface';
import { useAuth } from '@/lib/auth';

export default function LoyaltyPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<LoyaltyProgram | null>(null);
  const [formData, setFormData] = useState<Partial<LoyaltyProgram>>({});

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const programs = await api.getPrograms();
      setPrograms(programs);
    } catch (error) {
      console.error('Error loading loyalty programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProgram = async () => {
    try {
      const payload = user?.clientId ? { ...formData, clientId: user.clientId } : formData;
      const newProgram = await api.createProgram(payload as Record<string, unknown>);
      setPrograms([...programs, newProgram]);
      setShowProgramForm(false);
      setFormData({});
    } catch (error) {
      console.error('Error creating loyalty program:', error);
    }
  };

  const handleUpdateProgram = async () => {
    try {
      const updatedProgram = await api.updateProgram(selectedProgram?.clientId as string, formData as Record<string, unknown>);
      setPrograms(programs.map(p => p.id === selectedProgram?.id ? updatedProgram : p));
      setSelectedProgram(null);
      setFormData({});
    } catch (error) {
      console.error('Error updating loyalty program:', error);
    }
  };

  const handleDeleteProgram = async (clientId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este programa de fidelidad?')) {
      return;
    }
    try {
      await api.deleteProgram(clientId);
      setPrograms(programs.filter(p => p.clientId !== clientId));
    } catch (error) {
      console.error('Error deleting loyalty program:', error);
    }
  };

  const handleToggleActive = async (program: LoyaltyProgram) => {
    try {
      const updated = await api.toggleLoyaltyProgram(program.clientId);
      setPrograms(programs.map(p => p.id === program.id ? updated : p));
    } catch (error) {
      console.error('Error toggling loyalty program:', error);
    }
  };

  const openProgramForm = (program: LoyaltyProgram | null = null) => {
    setSelectedProgram(program);
    setFormData(program || {
      name: '',
      description: '',
      stampsToReward: 10,
      isActive: false,
      stampIcon: 'local_fire_department',
      stampColor: '#5950b6',
      backgroundColor: '#ffffff',
      textColor: '#191c1e',
      enableWhatsApp: false,
      welcomeMessage: '¡Bienvenido al programa de fidelidad! Recibirás un sello por cada visita.',
      rewardMessage: '¡Felicitaciones! Has completado tu tarjeta y ganado una recompensa.',
    });
    setShowProgramForm(true);
  };

  const handleSubmitProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProgram) {
      handleUpdateProgram();
    } else {
      handleCreateProgram();
    }
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
            Configura tu programa y actívalo cuando quieras mostrarlo a tus clientes en el portal público.
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

      {showProgramForm && (
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg">
            {selectedProgram ? 'Editar Programa' : 'Crear Programa'}
          </h3>

          <form onSubmit={handleSubmitProgram} className="space-y-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Nombre del Programa</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                  placeholder="Ej: Puntos Feliz"
                />
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Puntos para Recompensar</label>
                <input
                  type="number"
                  value={formData.stampsToReward}
                  onChange={(e) => setFormData({ ...formData, stampsToReward: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  min="1"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  rows={2}
                  placeholder="Describe el programa de fidelidad"
                />
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Ícono de Sello</label>
                <select
                  value={formData.stampIcon}
                  onChange={(e) => setFormData({ ...formData, stampIcon: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  <option value="local_fire_department">Fire</option>
                  <option value="star">Star</option>
                  <option value="workspace_premium">Premium</option>
                  <option value="card_giftcard">Gift</option>
                </select>
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Color del Sello</label>
                <input
                  type="color"
                  value={formData.stampColor}
                  onChange={(e) => setFormData({ ...formData, stampColor: e.target.value })}
                  className="w-full h-10 border border-outline-variant rounded-lg cursor-pointer"
                />
              </div>

              <div className="md:col-span-2 p-lg rounded-xl border border-outline-variant bg-surface-container-low">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 mt-0.5 text-primary border-outline-variant rounded focus:ring-0"
                  />
                  <div>
                    <span className="font-label-md text-label-md text-on-surface block">Activar programa en portal público</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Solo cuando está activo, tus clientes verán la pestaña de fidelidad, podrán registrarse y acumular sellos al completar citas.
                    </span>
                  </div>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableWhatsApp}
                    onChange={(e) => setFormData({ ...formData, enableWhatsApp: e.target.checked })}
                    className="w-5 h-5 text-primary border-outline-variant rounded focus:ring-0"
                  />
                  <span className="font-label-md text-label-md text-on-surface">Activar Notificaciones WhatsApp</span>
                </label>
              </div>
            </div>

            <div className="pt-md flex gap-3">
              <button
                type="submit"
                className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
              >
                {selectedProgram ? 'Actualizar Programa' : 'Crear Programa'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProgramForm(false);
                  setSelectedProgram(null);
                  setFormData({});
                }}
                className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

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
                  className={`px-3 py-1 rounded-full text-xs font-medium ${program.isActive
                    ? 'bg-secondary-container/30 text-on-secondary-container'
                    : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {program.isActive ? 'Activo' : 'Inactivo'}
                </div>
              </div>

              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{program.name}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-sm">{program.description}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
                {program.stampsToReward} {program.stampsToReward === 1 ? 'sello' : 'sellos'} necesarios para recompensa
              </p>

              {!program.isActive && (
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-md p-3 rounded-lg bg-surface-container-low border border-outline-variant">
                  Este programa está inactivo. Tus clientes no lo ven en el portal hasta que lo actives.
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
              Crea tu programa de fidelidad. Permanece inactivo hasta que decidas activarlo en el portal público.
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
    </div>
  );
}