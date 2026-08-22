'use client';

export type StampShape = 'heart' | 'circle' | 'star';
export type CardStyle = 'classic' | 'estudio';

export type CardDesign = {
  style: CardStyle;
  title: string;
  script: string;
  footerTitle: string;
  footerSubtitle: string;
  stampShape: StampShape;
  columns: 5 | 10;
  logoUrl?: string;
  milestoneColor?: string;
};

export type CardReward = {
  name: string;
  stampsRequired: number;
  rewardType: string;
  value: number;
};

export const DEFAULT_CARD_DESIGN: CardDesign = {
  style: 'classic',
  title: 'TARJETA',
  script: 'de fidelidad',
  footerTitle: 'Gracias por tu visita',
  footerSubtitle: 'Acumula visitas y obtén recompensas',
  stampShape: 'circle',
  columns: 5,
  milestoneColor: '#191c1e',
};

export function parseCardDesign(raw: unknown): CardDesign {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CARD_DESIGN };
  const d = parsed as Partial<CardDesign>;
  return {
    style: d.style === 'estudio' ? 'estudio' : 'classic',
    title: String(d.title || DEFAULT_CARD_DESIGN.title),
    script: String(d.script || DEFAULT_CARD_DESIGN.script),
    footerTitle: String(d.footerTitle || DEFAULT_CARD_DESIGN.footerTitle),
    footerSubtitle: String(d.footerSubtitle || DEFAULT_CARD_DESIGN.footerSubtitle),
    stampShape: d.stampShape === 'heart' || d.stampShape === 'star' ? d.stampShape : 'circle',
    columns: d.columns === 10 ? 10 : 5,
    logoUrl: d.logoUrl || '',
    milestoneColor: d.milestoneColor || DEFAULT_CARD_DESIGN.milestoneColor,
  };
}

function milestoneLabel(reward: CardReward) {
  if (reward.rewardType === 'PERCENTAGE_DISCOUNT') return `${reward.value}%`;
  if (reward.rewardType === 'FREE_SERVICE') return 'Gratis';
  if (reward.rewardType === 'FIXED_AMOUNT' || reward.rewardType === 'SERVICE_DISCOUNT') {
    return `$${reward.value}`;
  }
  return reward.name.slice(0, 8);
}

function StampShapeSvg({
  shape,
  fill,
  label,
}: {
  shape: StampShape;
  fill: string;
  label?: string;
}) {
  const path =
    shape === 'heart'
      ? 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
      : shape === 'star'
        ? 'M12 2l2.9 6.9L22 9.2l-5 4.6 1.5 7.2L12 17.8 5.5 21l1.5-7.2-5-4.6 7.1-1.3L12 2z'
        : 'M12 2a10 10 0 100 20 10 10 0 000-20z';

  return (
    <div className="relative w-full aspect-square">
      <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden>
        <path d={path} fill={fill} />
      </svg>
      {label && (
        <span className="absolute inset-0 flex items-center justify-center text-[7px] sm:text-[9px] font-bold text-white leading-none text-center px-0.5">
          {label}
        </span>
      )}
    </div>
  );
}

type Props = {
  design: CardDesign;
  stamps: number;
  earned?: number;
  stampColor: string;
  backgroundColor: string;
  textColor: string;
  rewards?: CardReward[];
  customerName?: string;
  compact?: boolean;
};

export default function LoyaltyStampCard({
  design,
  stamps,
  earned,
  stampColor,
  backgroundColor,
  textColor,
  rewards = [],
  customerName,
  compact = false,
}: Props) {
  const total = Math.max(1, stamps);
  const got = earned ?? total;
  const cols = design.columns === 10 && total >= 10 ? 10 : 5;
  const estudio = design.style === 'estudio';
  const milestones = new Map(rewards.map((r) => [r.stampsRequired, r]));

  return (
    <div
      className={`w-full rounded-2xl border border-black/5 shadow-sm overflow-hidden ${compact ? 'p-4' : 'p-5 sm:p-7'}`}
      style={{ backgroundColor, color: textColor }}
    >
      <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-3' : 'mb-5'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {design.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={design.logoUrl} alt="" className={`${compact ? 'h-8' : 'h-10'} w-auto object-contain`} />
          ) : null}
        </div>
        {customerName && (
          <p className="font-label-sm opacity-70 truncate text-right">{customerName}</p>
        )}
      </div>

      <div className={`relative text-center ${compact ? 'mb-3' : 'mb-6'}`}>
        <div
          className={`font-bold tracking-[0.18em] uppercase ${compact ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}
          style={{
            color: stampColor,
            fontFamily: estudio ? '"Cormorant Garamond", Georgia, serif' : 'inherit',
          }}
        >
          {design.title}
        </div>
        {design.script && (
          <div
            className={`absolute left-0 right-0 ${compact ? 'top-1 text-xl' : 'top-2 sm:top-3 text-2xl sm:text-3xl'}`}
            style={{
              fontFamily: '"Great Vibes", cursive',
              color: textColor,
            }}
          >
            {design.script}
          </div>
        )}
      </div>

      <div
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }).map((_, i) => {
          const n = i + 1;
          const reward = milestones.get(n);
          const filled = n <= got;
          const label = reward ? milestoneLabel(reward) : undefined;
          const fill = reward ? (design.milestoneColor || textColor) : stampColor;
          return (
            <div key={n} style={{ opacity: filled ? 1 : 0.22 }}>
              {estudio || design.stampShape !== 'circle' || reward ? (
                <StampShapeSvg shape={design.stampShape} fill={fill} label={label} />
              ) : (
                <div
                  className="aspect-square rounded-lg"
                  style={{ backgroundColor: filled ? stampColor : 'transparent', border: filled ? 'none' : `1.5px dashed ${stampColor}` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {(design.footerTitle || design.footerSubtitle) && (
        <div
          className={`text-center ${compact ? 'mt-3' : 'mt-6'}`}
          style={{ fontFamily: estudio ? '"Cormorant Garamond", Georgia, serif' : 'inherit' }}
        >
          {design.footerTitle && (
            <p className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} font-semibold`}>{design.footerTitle}</p>
          )}
          {design.footerSubtitle && (
            <p className={`${compact ? 'text-[11px]' : 'text-sm'} opacity-80 mt-0.5`}>{design.footerSubtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
