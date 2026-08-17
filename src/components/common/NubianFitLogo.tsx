import React from 'react';

interface NubianFitLogoProps {
  className?: string;
}

export const NubianFitLogo: React.FC<NubianFitLogoProps> = ({ className = "h-9 w-9" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`${className} shrink-0 transition-all duration-300 hover:scale-105 active:scale-95`}
    >
      {/* Outer Hexagon / Shield Frame */}
      <polygon 
        points="50,6 88,27 88,73 50,94 12,73 12,27" 
        className="stroke-emerald-500 stroke-[5] fill-emerald-500/10" 
        strokeLinejoin="round"
      />
      {/* Monogram geometry of N and F */}
      {/* Left pillar of N */}
      <path 
        d="M32 35 V65" 
        className="stroke-white dark:stroke-white stroke-[6.5] stroke-linecap-round" 
        style={{ stroke: 'var(--app-fg)' }}
      />
      {/* Diagonal slash of N */}
      <path 
        d="M32 35 L50 65" 
        className="stroke-white dark:stroke-white stroke-[6.5] stroke-linecap-round"
        style={{ stroke: 'var(--app-fg)' }}
      />
      {/* Right pillar of N + vertical of F */}
      <path 
        d="M50 35 V65" 
        className="stroke-white dark:stroke-white stroke-[6.5] stroke-linecap-round"
        style={{ stroke: 'var(--app-fg)' }}
      />
      {/* Top horizontal of F */}
      <path 
        d="M50 35 H68" 
        className="stroke-emerald-500 stroke-[6.5] stroke-linecap-round" 
      />
      {/* Middle horizontal of F / Dynamic upward arrow check */}
      <path 
        d="M38 52 L50 60 L68 40" 
        className="stroke-emerald-500 stroke-[6.5] stroke-linecap-round stroke-linejoin-round" 
      />
      {/* Arrow head on the check tip */}
      <path 
        d="M60 40 H68 V48" 
        className="stroke-emerald-500 stroke-[6.5] stroke-linecap-round stroke-linejoin-round" 
      />
    </svg>
  );
};
