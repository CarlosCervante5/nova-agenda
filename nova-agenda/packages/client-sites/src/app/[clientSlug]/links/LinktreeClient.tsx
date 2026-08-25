'use client';

import { useState } from 'react';

interface LinkItem {
  title: string;
  url: string;
  icon: string;
  color?: string;
}

interface Props {
  client: {
    name: string;
    slug: string;
    logo?: string;
    tagline?: string;
    primaryColor: string;
    coverImage?: string;
  };
  links: LinkItem[];
}

export default function LinktreeClient({ client, links }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const primary = client.primaryColor || '#2dd4bf';

  return (
    <div
      className="min-h-screen flex flex-col items-center py-12 px-4"
      style={{
        backgroundColor: '#0f0f1a',
        backgroundImage: client.coverImage
          ? `linear-gradient(rgba(15,15,26,0.85), rgba(15,15,26,0.95)), url(${client.coverImage})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Profile */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4"
          style={{ borderColor: primary, backgroundColor: `${primary}22` }}
        >
          {client.logo ? (
            <img src={client.logo} alt={client.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-4xl" style={{ color: primary }}>
              spa
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
          {client.name}
        </h1>
        {client.tagline && (
          <p className="text-sm text-[#888] mt-1 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
            {client.tagline}
          </p>
        )}
      </div>

      {/* Links */}
      <div className="w-full max-w-md space-y-3">
        {links.map((link, i) => {
          const isHovered = hoveredIdx === i;
          const linkColor = link.color || primary;
          return (
            <a
              key={i}
              href={link.url}
              target={link.url.startsWith('http') ? '_blank' : '_self'}
              rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-4 w-full px-5 py-4 rounded-2xl transition-all duration-200"
              style={{
                backgroundColor: isHovered ? `${linkColor}22` : '#1a1a2e',
                border: `2px solid ${isHovered ? linkColor : '#2a2a3e'}`,
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 shrink-0"
                fill={isHovered ? linkColor : '#888'}
              >
                <path d={link.icon} />
              </svg>
              <span
                className="text-base font-semibold"
                style={{
                  color: isHovered ? linkColor : '#e0e0e0',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {link.title}
              </span>
              <span className="material-symbols-outlined ml-auto text-lg" style={{ color: isHovered ? linkColor : '#555' }}>
                arrow_forward
              </span>
            </a>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-xs text-[#555]" style={{ fontFamily: 'Inter, sans-serif' }}>
          Powered by Nova Agenda
        </p>
      </div>
    </div>
  );
}
