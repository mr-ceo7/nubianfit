/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader } from './Loader';



interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 2400,
}) => {
  useEffect(() => {
    const completeTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, minDurationMs);

    return () => {
      clearTimeout(completeTimer);
    };
  }, [minDurationMs, onFinish]);


  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.5, ease: 'easeInOut' } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 overflow-hidden select-none"
    >
      {/* Ambient background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Core Perspective Sliced Loader (Centered, Large, and Visible) */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative"
      >
        <Loader
          text="NUBIANFIT"
          size="40rem"
          textColor="#ffffff"
          shadowColor="#153e38"
          shineColor="rgba(34, 211, 238, 0.45)"
        />

      </motion.div>
    </motion.div>

  );
};
