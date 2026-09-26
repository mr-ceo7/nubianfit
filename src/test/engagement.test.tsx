import { describe, test, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { consumeDeepLink } from '../utils/deepLink';
import { NotificationBell } from '../components/engagement/NotificationBell';
import { tokenStore } from '../services/apiClient';
import { mockApi, coachUser, renderWithProviders } from './helpers';

describe('deep links from notifications', () => {
  test('reads open/clientId/groupId and keeps other params', () => {
    window.history.replaceState(null, '', '/?portal=coach&open=messenger&clientId=c1');
    expect(consumeDeepLink()).toEqual({ tab: 'messenger', clientId: 'c1', groupId: undefined });
    expect(window.location.search).toBe('?portal=coach');
    expect(consumeDeepLink()).toBeNull();
  });
});

describe('NotificationBell', () => {
  beforeEach(() => {
    localStorage.clear();
    tokenStore.set('tok');
  });

  test('shows the unread count and navigates + marks read on click', async () => {
    const now = new Date().toISOString();
    const { calls } = mockApi({
      'GET /auth/me': () => ({ json: coachUser }),
      'GET /notifications': () => ({ json: {
        unreadCount: 1,
        items: [{ id: 'n1', type: 'message', title: 'New message from Marcus', body: 'Hi', link: { tab: 'messenger', clientId: 'c1' }, readAt: null, createdAt: now }],
      } }),
      'POST /notifications/read': () => ({ json: { message: 'ok' } }),
      'GET /preferences': () => ({ json: { emailDigest: true } }),
    });
    const navigated: unknown[] = [];
    renderWithProviders(<NotificationBell onNavigate={link => navigated.push(link)} />);

    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' }, { timeout: 5000 });
    await userEvent.click(bell);
    await userEvent.click(screen.getByText('New message from Marcus'));

    expect(navigated).toEqual([{ tab: 'messenger', clientId: 'c1' }]);
    await waitFor(() => expect(calls.some(c => c.path === '/notifications/read')).toBe(true));
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });
});
