import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../context/AppContext';

vi.mock('../services/apiClient', () => ({
  authApi: { me: vi.fn().mockResolvedValue({ email: 'coach@nubianfit.com' }) },
  clientsApi: { list: vi.fn().mockResolvedValue([]) },
  exercisesApi: { list: vi.fn().mockResolvedValue([]) },
  programsApi: { list: vi.fn().mockResolvedValue([]) },
  workoutsApi: { list: vi.fn().mockResolvedValue([]) },
  metricsApi: { list: vi.fn().mockResolvedValue([]) },
  prsApi: { list: vi.fn().mockResolvedValue([]) },
  habitsApi: { list: vi.fn().mockResolvedValue([]) },
  photosApi: { list: vi.fn().mockResolvedValue([]) },
  messagesApi: { list: vi.fn().mockResolvedValue([]) },
  activityApi: { list: vi.fn().mockResolvedValue([]) },
}));

const ThemeTesterComponent = () => {
  const { theme, toggleTheme } = useApp();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle</button>
    </div>
  );
};

describe('Theme Context Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  test('should default to light mode', () => {
    render(
      <AppProvider>
        <ThemeTesterComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('theme-value').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  test('should toggle to dark mode and add dark class to documentElement', () => {
    render(
      <AppProvider>
        <ThemeTesterComponent />
      </AppProvider>
    );

    const button = screen.getByTestId('toggle-btn');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('theme-value').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
