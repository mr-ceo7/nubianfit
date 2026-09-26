import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { AppProvider } from '../context/AppContext';
import { NutritionProvider } from '../context/NutritionContext';

type Handler = (body: unknown, url: URL) => { status?: number; json: unknown };

/**
 * Stub global fetch with a small route table keyed by "METHOD /path".
 * Unmatched requests return an empty list, which is what every collection endpoint returns for a new account.
 */
export function mockApi(routes: Record<string, Handler> = {}) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method || 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    const result = handler ? handler(body, url) : { json: [] };
    const status = result.status ?? 200;
    return new Response(JSON.stringify(result.json), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

export const coachUser = {
  id: 'coach-1',
  email: 'coach@example.com',
  fullName: 'Test Coach',
  role: 'coach',
  clientId: null,
  avatar: '',
  isActive: true,
  hasPassword: true,
};

export const clientUser = {
  ...coachUser,
  id: 'user-1',
  email: 'athlete@example.com',
  fullName: 'Test Athlete',
  role: 'client',
  clientId: 'client-1',
  hasPassword: false,
};

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <AppProvider>
        <NutritionProvider>{ui}</NutritionProvider>
      </AppProvider>
    </AuthProvider>
  );
}
