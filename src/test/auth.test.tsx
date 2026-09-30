import { describe, test, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import App from '../App';
import { render } from '@testing-library/react';
import { tokenStore, api } from '../services/apiClient';
import { mockApi, coachUser, clientUser } from './helpers';

const renderPortal = (portal: 'coach' | 'client') => {
  window.history.replaceState(null, '', `/?portal=${portal}`);
  return render(<App />);
};

describe('authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('coach portal requires sign-in, then loads data with the token', async () => {
    const { calls } = mockApi({
      'POST /auth/login': body => {
        const { password } = body as { password: string };
        return password === 'right-password'
          ? { json: { accessToken: 'tok-coach', tokenType: 'bearer', user: coachUser } }
          : { status: 401, json: { detail: 'Invalid email or password' } };
      },
    });
    renderPortal('coach');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'coach@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'right-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(calls.some(c => c.path === '/clients')).toBe(true));
    expect(tokenStore.get()).toBe('tok-coach');
    expect(await screen.findAllByText('Test Coach', {}, { timeout: 8000 })).not.toHaveLength(0);
  });

  test('client signs in with an emailed code', async () => {
    const { calls } = mockApi({
      'POST /auth/otp/request': () => ({ json: { message: 'sent' } }),
      'POST /auth/otp/verify': () => ({ json: { accessToken: 'tok-client', tokenType: 'bearer', user: clientUser } }),
      'GET /clients': () => ({ json: [{ id: 'client-1', name: 'Test Athlete', email: 'athlete@example.com', complianceRate: 90, currentWeightKg: 80, startingWeightKg: 82, targetWeightKg: 75 }] }),
    });
    renderPortal('client');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'athlete@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    await user.type(await screen.findByLabelText('Login code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/Hi Test/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(calls.find(c => c.path === '/auth/otp/verify')?.body).toEqual({ email: 'athlete@example.com', code: '123456' });
  });

  test('a coach account opening the client app is sent to Coach OS', async () => {
    tokenStore.set('tok-coach');
    mockApi({ 'GET /auth/me': () => ({ json: coachUser }) });
    renderPortal('client');
    expect(await screen.findByText('Wrong app')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Coach OS' })).toBeInTheDocument();
  });

  test('a rejected token signs the user out', async () => {
    tokenStore.set('stale');
    mockApi({ 'GET /auth/me': () => ({ status: 401, json: { detail: 'Invalid or expired authentication token' } }) });
    renderPortal('coach');
    expect(await screen.findByText('Coach sign in')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  test('API errors surface the server detail', async () => {
    mockApi({ 'GET /boom': () => ({ status: 400, json: { detail: 'You already have a client with this email' } }) });
    await expect(api.get('/boom')).rejects.toThrow('You already have a client with this email');
  });

  test('global pay link renders PayPage without portal parameter or sign-in', async () => {
    mockApi({
      'GET /pay/tok-123': () => ({
        json: {
          status: 'pending',
          purpose: 'purchase',
          coachName: 'Coach Carter',
          clientFirstName: 'Sarah',
          packageTitle: 'Monthly 1:1 Coaching',
          packageDescription: 'Full coaching access',
          billing: 'recurring',
          interval: 'monthly',
          amount: 5000,
          currency: 'KES',
          paymentsEnabled: true,
        },
      }),
    });
    window.history.replaceState(null, '', '/?pay=tok-123');
    render(<App />);
    expect(await screen.findByText('Complete your payment', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/Coach Carter · Monthly 1:1 Coaching/)).toBeInTheDocument();
  });

  test('athlete self-registers through open onboarding', async () => {
    const { calls } = mockApi({
      'POST /auth/register-client': () => ({
        json: { accessToken: 'tok-new-athlete', tokenType: 'bearer', user: { ...clientUser, id: 'user-new', fullName: 'Jane Doe', email: 'jane@example.com' } }
      }),
      'GET /clients': () => ({ json: [{ id: 'client-1', name: 'Jane Doe', email: 'jane@example.com', complianceRate: 100, currentWeightKg: 65, startingWeightKg: 65, targetWeightKg: 60 }] }),
    });
    renderPortal('client');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Join NubianFit' }));
    expect(await screen.findByText('Join NubianFit')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email address'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Start Training' }));

    await waitFor(() => expect(calls.some(c => c.path === '/auth/register-client')).toBe(true));
    expect(tokenStore.get()).toBe('tok-new-athlete');
  });

  test('athlete renders Google One Tap and sign-in button', async () => {
    renderPortal('client');
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });
});
