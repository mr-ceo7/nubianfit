import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '../context/AppContext';
import { CoachDashboard } from '../components/dashboard/CoachDashboard';

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

describe('CoachDashboard Responsive Tabs Tests', () => {
  test('should render segmented control tabs on mobile viewports', () => {
    const handleOpenNewClient = vi.fn();
    const handleOpenNewProgram = vi.fn();

    render(
      <AppProvider>
        <CoachDashboard 
          onOpenNewClient={handleOpenNewClient}
          onOpenNewProgram={handleOpenNewProgram}
        />
      </AppProvider>
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
