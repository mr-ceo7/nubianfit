/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface LoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  textColor?: string;
  shadowColor?: string;
  shineColor?: string;
  className?: string;
  subtext?: string;
}

const sizeMap: Record<string, string> = {
  sm: '2.2rem',
  md: '3.2rem',
  lg: '4.2rem',
  xl: '5.5rem',
};

export const Loader: React.FC<LoaderProps> = ({
  text = 'Loading',
  size = 'md',
  textColor = '#ffffff',
  shadowColor = '#94a3b8',
  shineColor = 'rgba(255, 255, 255, 0.35)',
  className = '',
  subtext,
}) => {
  const mainSize = sizeMap[size] || size;

  const styleVariables: React.CSSProperties & Record<string, string> = {
    '--main-size': mainSize,
    '--text-color': textColor,
    '--shadow-color': shadowColor,
    '--shine-color': shineColor,
  };

  return (
    <div className={`flex flex-col items-center justify-center p-4 ${className}`}>
      <div 
        className="perspective-loader"
        style={styleVariables}
        role="status"
        aria-label={text}
      >
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="slice-text"><span>{text}</span></div>
        <div className="loader-line" />
      </div>

      {subtext && (
        <p className="mt-3 text-xs font-mono text-slate-400 tracking-wider uppercase animate-pulse">
          {subtext}
        </p>
      )}
    </div>
  );
};

export default Loader;
