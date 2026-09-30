import React from 'react';
import { NubianFitBrand, NubianFitMonogram, NubianFitBrandProps } from './NubianFitBrand';

export { NubianFitBrand, NubianFitMonogram };
export type { NubianFitBrandProps };

interface NubianFitLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
}

/**
 * Brand logo component unified with Coach OS branding:
 * lowercase Bruno Ace wordmark ("nubianfit") + "strength and strategy" tagline.
 */
export const NubianFitLogo: React.FC<NubianFitLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true,
}) => {
  return (
    <NubianFitBrand
      size={size}
      className={className}
      showTagline={showTagline}
    />
  );
};
