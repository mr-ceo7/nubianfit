/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Smartphone, 
  Share2, 
  PlusSquare, 
  CheckCircle2, 
  X, 
  Zap, 
  WifiOff, 
  Bell,
  Dumbbell
} from 'lucide-react';
import { promptInstall, isPwaInstalled, isIosDevice, subscribeToInstallPrompt, BeforeInstallPromptEvent } from '../../utils/pwa';


interface PwaInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ isOpen, onClose }) => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setIsInstalled(isPwaInstalled());
    setIsIos(isIosDevice());

    const unsubscribe = subscribeToInstallPrompt((prompt) => {
      setInstallPromptEvent(prompt);
    });

    return () => unsubscribe();
  }, []);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    const accepted = await promptInstall();
    setIsInstalling(false);
    if (accepted) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
      <div className="nf-fade-in fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md">
        {/* Backdrop dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Modal Sheet */}
        <div
          className="nf-slide-up relative w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto pb-safe"
        >
          {/* Top handle on mobile */}
          <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="mb-4 text-left">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Install <span className="font-logo text-logo-nubian lowercase">nubian<span className="text-logo-fit">fit</span></span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                PWA
              </span>
            </h3>


            <p className="text-xs text-slate-400 mt-1">Install for quick home screen access and offline support</p>
          </div>


          {/* Benefits Grid */}
          <div className="grid grid-cols-2 gap-2.5 my-5">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">Instant Performance</span>
              <span className="text-[11px] text-slate-400 leading-tight">Fast standalone UI without browser bars</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col gap-1.5">
              <WifiOff className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">Offline Logging</span>
              <span className="text-[11px] text-slate-400 leading-tight">Record gym sets even without internet</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col gap-1.5">
              <Smartphone className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-semibold text-slate-200">Native Bottom Nav</span>
              <span className="text-[11px] text-slate-400 leading-tight">One-thumb ergonomic gym navigation</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col gap-1.5">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-200">Rest Audio & Alerts</span>
              <span className="text-[11px] text-slate-400 leading-tight">Sound cues for set countdown timers</span>
            </div>
          </div>

          {/* iOS Safari Instructions */}
          {isIos && (
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 mb-5 text-xs text-slate-300 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <Share2 className="w-4 h-4" />
                <span>How to Install on iPhone / iPad:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[12px]">
                <li>Tap the <span className="font-semibold text-white">Share</span> icon at the bottom of Safari</li>
                <li>Scroll down and tap <span className="font-semibold text-white">"Add to Home Screen"</span> <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" /></li>
                <li>Tap <span className="font-semibold text-emerald-400">Add</span> in the top-right corner</li>
              </ol>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {!isIos && (
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                {isInstalling ? 'Installing NubianFit...' : 'Install App to Home Screen'}
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white font-medium text-xs transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
  );
};
