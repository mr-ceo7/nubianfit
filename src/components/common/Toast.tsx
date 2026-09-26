import React from 'react';
import { useApp } from '../../context/AppContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();
  if (!toastMessage) return null;
  return (
    <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-[60] max-w-[90vw] px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white shadow-xl">
      {toastMessage}
    </div>
  );
};
