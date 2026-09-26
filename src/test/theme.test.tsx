import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import React from 'react';
import { useApp } from '../context/AppContext';
import { renderWithProviders, mockApi } from './helpers';


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
    mockApi();
    document.documentElement.className = '';
  });

  test('should default to light mode', () => {
    renderWithProviders(
      <ThemeTesterComponent />
    );

    expect(screen.getByTestId('theme-value').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  test('should toggle to dark mode and add dark class to documentElement', () => {
    renderWithProviders(
      <ThemeTesterComponent />
    );

    const button = screen.getByTestId('toggle-btn');
    act(() => {
      button.click();
    });

    expect(screen.getByTestId('theme-value').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
