import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClientNutritionPanel } from './ClientNutritionPanel';
import { CustomFoodManager } from './CustomFoodManager';
import { MealPlanBuilder } from './MealPlanBuilder';

type Section = 'clients' | 'plans' | 'foods';

/** Coach OS nutrition & habits tab. */
export const NutritionHub: React.FC = () => {
  const { clients, selectedClientId, setSelectedClientId } = useApp();
  const [section, setSection] = useState<Section>('clients');
  const clientId = selectedClientId && clients.some(c => c.id === selectedClientId) ? selectedClientId : clients[0]?.id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-3 rounded-xl bg-slate-900 border border-slate-800 p-1 text-sm">
          {([['clients', 'Clients'], ['plans', 'Meal plans'], ['foods', 'Foods']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setSection(id)} aria-pressed={section === id}
              className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold ${section === id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
        {section === 'clients' && clients.length > 0 && (
          <select
            aria-label="Client"
            value={clientId}
            onChange={e => setSelectedClientId(e.target.value)}
            className="h-10 px-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-white"
          >
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {section === 'clients' && (clientId
        ? <ClientNutritionPanel clientId={clientId} />
        : <p className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-300">Add a client to set their nutrition targets and habits.</p>)}
      {section === 'plans' && <MealPlanBuilder />}
      {section === 'foods' && <CustomFoodManager />}
    </div>
  );
};
