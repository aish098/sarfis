import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PayrollDashboard from './PayrollDashboard';
import api from '../../services/api';

// Mock the API service to return database rows
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/reports/register')) {
        return Promise.resolve({ 
          data: [{ 
            period: '2026-08', 
            status: 'DRAFT', 
            total_net: 100000, 
            total_gross: 120000, 
            total_deductions: 10000 
          }] 
        });
      }
      if (url.includes('/payroll/1/employees')) {
        return Promise.resolve({ 
          data: [
            { employee_id: 1, payment_status: 'PAID' },
            { employee_id: 2, payment_status: 'FAILED' }
          ] 
        });
      }
      if (url.includes('/employees')) {
        return Promise.resolve({ 
          data: [
            { id: 1, name: 'Alice', bank_account: '' },
            { id: 2, name: 'Bob', bank_account: 'PK12HABB001' }
          ] 
        });
      }
      if (url.includes('/audit')) {
        return Promise.resolve({ 
          data: {
            logs: [
              { id: 1, user_name: 'Ahmed', action: 'RUN_PAYROLL', entity_type: 'PAYROLL', created_at: '2026-07-11T12:00:00Z' }
            ]
          }
        });
      }
      return Promise.resolve({ data: [] });
    })
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

  it('displays the correct smart recommendations list dynamically', async () => {
    render(<PayrollDashboard userRole="HR Manager" onNavigateToTab={mockNavigate} />);
    
    // Check recommendations text resolves async
    expect(await screen.findByText(/1 employee\(s\) missing bank accounts/i)).toBeInTheDocument();
    expect(await screen.findByText(/1 payment clearance line\(s\) failed/i)).toBeInTheDocument();
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
