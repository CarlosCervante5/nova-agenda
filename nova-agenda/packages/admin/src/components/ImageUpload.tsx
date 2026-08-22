'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind?: 'logo' | 'cover' | 'avatar' | 'loyalty' | 'image';
  hint?: string;
  preview?: 'square' | 'wide';
};

export default function ImageUpload({
  label,
  value,
  onChange,
  kind = 'image',
  hint,
  preview = 'square',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await api.uploadImage(file, kind);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="font-label-md text-on-surface mb-xs block">{label}</label>
      <div className={`flex gap-4 ${preview === 'wide' ? 'flex-col sm:flex-row sm:items-start' : 'items-start'}`}>
        <div
          className={`shrink-0 overflow-hidden bg-surface-container-high border border-outline-variant ${
            preview === 'wide' ? 'w-full sm:w-56 h-28 rounded-xl' : 'w-20 h-20 rounded-xl'
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined">image</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-label-sm font-bold hover:border-primary disabled:opacity-50"
            >
              {uploading ? 'Subiendo…' : value ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
            {value && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => onChange('')}
                className="px-4 py-2 text-error font-label-sm"
              >
                Quitar
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <p className="font-body-sm text-on-surface-variant">
            {hint || 'JPG, PNG, WEBP o GIF. Máximo 5 MB. Se guarda en el volumen del servidor.'}
          </p>
          {error && <p className="font-body-sm text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
