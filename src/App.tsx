/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NutritionProvider } from './context/NutritionContext';
import { EngagementProvider } from './context/EngagementContext';
import { allowsPortalOverride, detectPortal, Portal, portalHref } from './config/portal';
import { Loader } from './components/common/Loader';
import { NubianFitBrand } from './components/common/NubianFitBrand';
import { CoachLogin } from './components/auth/CoachLogin';
import { ClientLogin } from './components/auth/ClientLogin';
import { AuthShell } from './components/auth/AuthShell';

// Each hostname only ever shows one portal, so load them on demand.
const LandingPage = lazy(() => import('./components/landing/LandingPage').then(m => ({ default: m.LandingPage })));
const CoachLayout = lazy(() => import('./components/layout/CoachLayout').then(m => ({ default: m.CoachLayout })));
const ClientApp = lazy(() => import('./components/clientApp/ClientApp').then(m => ({ default: m.ClientApp })));

/** Shown when someone signs in to the portal meant for the other role. */
const WrongPortal: React.FC<{ target: Portal; message: string }> = ({ target, message }) => {
  const { logout } = useAuth();
  return (
    <AuthShell title="Wrong app" subtitle={message}>
      <div className="space-y-3">
        <a href={portalHref(target)} className="block text-center w-full rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm py-2.5">
          {target === 'client' ? 'Open the client app' : 'Open Coach OS'}
        </a>
        <button onClick={logout} className="w-full text-xs text-slate-400 hover:text-white">Sign out</button>
      </div>
    </AuthShell>
  );
};

const FullScreenLoader: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
    <NubianFitBrand size="lg" />
    <Loader text="Loading" size="sm" />
  </div>
);

const CoachPortal: React.FC = () => {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'signed_out') return <CoachLogin />;
  if (user?.role !== 'coach') {
    return <WrongPortal target="client" message="You're signed in with a client account. Your training lives in the client app." />;
  }
  return <CoachLayout />;
};

const PayPage = lazy(() => import('./components/business/PayPage').then(m => ({ default: m.PayPage })));

const ClientPortal: React.FC = () => {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'signed_out') return <ClientLogin />;
  if (user?.role !== 'client') {
    return <WrongPortal target="coach" message="You're signed in as a coach. Manage your clients in Coach OS." />;
  }
  return <ClientApp />;
};

/** Local/preview-only switcher, since those hosts can't tell the portals apart. */
const DevPortalSwitcher: React.FC<{ current: Portal }> = ({ current }) => (
  <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[70] flex gap-1 rounded-full bg-neutral-900 p-1 text-[10px] font-bold">
    {(['landing', 'coach', 'client'] as Portal[]).map(p => (
      <a key={p} href={portalHref(p)} className={`px-2 py-1 rounded-full ${p === current ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-300'}`}>
        {p}
      </a>
    ))}
  </div>
);

export default function App() {
  const [portal] = useState(detectPortal);
  const payToken = new URLSearchParams(window.location.search).get('pay');

  // Only the marketing site should be indexed by search engines.
  useEffect(() => {
    if (portal === 'landing' && !payToken) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [portal, payToken]);

  return (
    <AuthProvider>
      <AppProvider>
        <NutritionProvider>
          <EngagementProvider>
            <Suspense fallback={<FullScreenLoader />}>
              {payToken ? (
                <PayPage token={payToken} />
              ) : (
                <>
                  {portal === 'landing' && <LandingPage />}
                  {portal === 'coach' && <CoachPortal />}
                  {portal === 'client' && <ClientPortal />}
                </>
              )}
            </Suspense>
            {allowsPortalOverride() && !payToken && <DevPortalSwitcher current={portal} />}
          </EngagementProvider>
        </NutritionProvider>
      </AppProvider>
    </AuthProvider>
  );
}
