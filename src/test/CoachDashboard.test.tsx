import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithProviders, mockApi } from './helpers';
import { CoachDashboard } from '../components/dashboard/CoachDashboard';


describe('CoachDashboard Responsive Tabs Tests', () => {
  beforeEach(() => {
    mockApi();
  });

  test('should render segmented control tabs on mobile viewports', () => {
    const handleOpenNewClient = vi.fn();
    const handleOpenNewProgram = vi.fn();

    renderWithProviders(
      <CoachDashboard 
          onOpenNewClient={handleOpenNewClient}
          onOpenNewProgram={handleOpenNewProgram}
        />
    );

    // Verify segmented controls are in the DOM
    const scheduleTab = screen.getByText("Today's Schedule");
    const activityTab = screen.getByText("Activity Feed");
    const watchlistTab = screen.getByText("Watchlist");

    expect(scheduleTab).toBeInTheDocument();
    expect(activityTab).toBeInTheDocument();
    expect(watchlistTab).toBeInTheDocument();
  });
});
