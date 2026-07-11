import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PayrollDashboard from './PayrollDashboard';

// Mock the API service to prevent actual network calls during unit testing
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] }))
  }
}));

// Mock the Auth Store
vi.mock('../../store/authStore', () => ({
  default: () => ({
    activeCompany: { id: 1, name: 'Test Company' }
  })
}));

describe('PayrollDashboard UI Component', () => {
  const mockNavigate = vi.fn();

  it('renders command header and standard cockpit layout', async () => {
    render(<PayrollDashboard userRole="HR Manager" onNavigateToTab={mockNavigate} />);
    
    // Check that title header is present
    expect(screen.getByText('Payroll Command Center')).toBeInTheDocument();
    
    // Check that intelligent action cards headers are rendered
    expect(screen.getByText('Generate Payroll')).toBeInTheDocument();
    expect(screen.getByText('Workflow Approval sign-off')).toBeInTheDocument();
    expect(screen.getByText('Direct Treasury Payouts')).toBeInTheDocument();
    expect(screen.getByText('Bank Statement Reconciliation')).toBeInTheDocument();
  });

  it('displays the correct smart recommendations list', () => {
    render(<PayrollDashboard userRole="HR Manager" onNavigateToTab={mockNavigate} />);
    
    // Check recommendations text
    expect(screen.getByText(/3 employees have no bank accounts/i)).toBeInTheDocument();
    expect(screen.getByText(/budget exceeded by 4.2%/i)).toBeInTheDocument();
  });

  it('renders role-specific My Work tasks for HR Manager', () => {
    render(<PayrollDashboard userRole="HR Manager" onNavigateToTab={mockNavigate} />);
    
    // HR Manager tasks check
    expect(screen.getByText(/Review Aug 2026 calculations and submit for sign-off/i)).toBeInTheDocument();
    expect(screen.getByText(/3 employee compliance exceptions/i)).toBeInTheDocument();
  });

  it('renders role-specific My Work tasks for Treasury', () => {
    render(<PayrollDashboard userRole="Treasury" onNavigateToTab={mockNavigate} />);
    
    // Treasury tasks check
    expect(screen.getByText(/Authorize bank disbursement batch/i)).toBeInTheDocument();
    expect(screen.getByText(/5 payment lines pending bank statement/i)).toBeInTheDocument();
  });
});
