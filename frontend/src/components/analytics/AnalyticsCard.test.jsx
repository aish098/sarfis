import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnalyticsCard from './AnalyticsCard';

describe('AnalyticsCard UI Component', () => {
  it('renders card title and children correctly', () => {
    render(
      <AnalyticsCard title="Test Chart Title">
        <div data-testid="mock-chart">Mock Chart Content</div>
      </AnalyticsCard>
    );

    expect(screen.getByText(/Test Chart Title/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
  });

  it('renders KPI summary statistics when provided', () => {
    const kpis = [
      { label: 'Variance', value: 'PKR 30k', change: '+6.4%', isPositive: true }
    ];

    render(
      <AnalyticsCard title="Test Chart Title" kpis={kpis}>
        <div>Chart</div>
      </AnalyticsCard>
    );

    expect(screen.getByText(/Variance/i)).toBeInTheDocument();
    expect(screen.getByText('PKR 30k')).toBeInTheDocument();
    expect(screen.getByText('+6.4%')).toBeInTheDocument();
  });
});
