import React from 'react';

export type BrandSize = 'sm' | 'md' | 'lg' | 'xl';

export interface NubianFitBrandProps {
  size?: BrandSize;
  badge?: string;
  badgeColor?: 'emerald' | 'cyan' | 'amber' | 'slate';
  showTagline?: boolean;
  className?: string;
}

const sizeConfig: Record<
  BrandSize,
  {
    titleText: string;
    taglineText: string;
    taglineSpacing: string;
    badgeText: string;
  }
> = {
  sm: {
    titleText: 'text-[15px]',
    taglineText: 'text-[7px]',
    taglineSpacing: 'mt-1',
    badgeText: 'text-[8px] px-1 py-0.5',
  },
  md: {
    titleText: 'text-[17px]',
    taglineText: 'text-[8px]',
    taglineSpacing: 'mt-1.5',
    badgeText: 'text-[9px] px-1.5 py-0.5',
  },
  lg: {
    titleText: 'text-[22px]',
    taglineText: 'text-[10px]',
    taglineSpacing: 'mt-2',
    badgeText: 'text-[10px] px-2 py-0.5',
  },
  xl: {
    titleText: 'text-[30px]',
    taglineText: 'text-[13px]',
    taglineSpacing: 'mt-2.5',
    badgeText: 'text-xs px-2.5 py-1',
  },
};

const badgeColorClasses: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
};

/**
 * Standard NubianFit brand component matching the Coach OS design:
 * lowercase Bruno Ace wordmark ("nubianfit") + justified "strength and strategy" tagline.
 */
export const NubianFitBrand: React.FC<NubianFitBrandProps> = ({
  size = 'md',
  badge,
  badgeColor = 'emerald',
  showTagline = true,
  className = '',
}) => {
  const cfg = sizeConfig[size];
  const badgeStyle = badgeColorClasses[badgeColor] || badgeColorClasses.emerald;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className="flex flex-col items-stretch text-left">
        <span
          className={`font-logo ${cfg.titleText} tracking-wide text-logo-nubian lowercase block leading-none select-none`}
        >
          nubian<span className="text-logo-fit">fit</span>
        </span>
        {showTagline && (
          <div
            className={`flex justify-between ${cfg.taglineText} text-slate-400 font-bold tracking-normal lowercase ${cfg.taglineSpacing} w-full leading-none select-none`}
          >
            <span>strength</span>
            <span>and</span>
            <span>strategy</span>
          </div>
        )}
      </div>

      {badge && (
        <span
          className={`${cfg.badgeText} font-bold uppercase tracking-widest rounded-md border leading-none self-start mt-0.5 select-none ${badgeStyle}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
};

/**
 * Compact monogram ("nf") used in collapsed sidebars or square avatars.
 */
export const NubianFitMonogram: React.FC<{ className?: string; size?: string }> = ({
  className = '',
  size = 'text-lg',
}) => (
  <div
    className={`flex h-10 w-10 shrink-0 items-center justify-center font-logo ${size} lowercase select-none ${className}`}
  >
    <span className="text-logo-nubian">n</span>
    <span className="text-logo-fit">f</span>
  </div>
);
