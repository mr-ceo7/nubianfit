/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader } from './Loader';
import { Dumbbell, ShieldCheck, Zap } from 'lucide-react';
import { NubianFitLogo } from './NubianFitLogo';


interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

const statusSteps = [
  'Initializing Performance Engine...',
  'Syncing Athlete Rosters & Telemetry...',
  'Loading Periodized Training Splits...',
  'System Ready',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 2400,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < statusSteps.length - 1) return prev + 1;
        return prev;
      });
    }, minDurationMs / statusSteps.length);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return Math.min(100, prev + Math.floor(Math.random() * 18) + 8);
      });
    }, 180);

    const completeTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, minDurationMs);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
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

      {/* Brand Badge */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-3 mb-8 px-4.5 py-2.5 rounded-full bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md"
      >
        <span className="font-logo text-xs tracking-wider text-emerald-400 lowercase">nubianfit</span>
        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
          PRO COACH v2.4
        </span>
      </motion.div>


      {/* Core Perspective Sliced Loader */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative"
      >
        <Loader
          text="LOADING"
          size="lg"
          textColor="#ffffff"
          shadowColor="#64748b"
          shineColor="rgba(52, 211, 153, 0.45)"
        />
      </motion.div>

      {/* Dynamic Status Text & Progress Bar */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex flex-col items-center w-72 max-w-xs px-4"
      >
        <div className="w-full flex justify-between items-center text-[11px] font-mono text-slate-400 mb-2">
          <span className="truncate pr-2">{statusSteps[stepIndex]}</span>
          <span className="text-emerald-400 font-bold">{Math.min(100, progress)}%</span>
        </div>

        {/* Progress rail */}
        <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ type: 'spring', damping: 15 }}
          />
        </div>

        {/* System badges */}
        <div className="flex items-center gap-4 mt-6 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> AES-256 Cloud Sync
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> Realtime Telemetry
          </span>
        </div>
      </motion.div>

      {/* Skip button for rapid dev/coaching flow */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={onFinish}
        className="absolute bottom-8 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-900 border border-transparent hover:border-slate-800"
      >
        Press to skip [ESC]
      </motion.button>
    </motion.div>
  );
};
