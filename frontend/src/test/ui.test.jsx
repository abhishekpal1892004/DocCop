import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge, Button, Input, Modal, Table, EmptyState } from '../components/ui';

describe('MediBook Design System UI Primitives', () => {
  it('renders Button with loading spinner and disabled state', () => {
    render(<Button loading>Saving</Button>);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('associates Input label, required indicator, and error message', () => {
    render(<Input label="Email" required error="Invalid email address" />);
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address');
  });

  it('renders Badge with accessible text label (never color-only)', () => {
    render(<Badge status="CONFIRMED" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('opens Modal with role=dialog and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm Cancellation">
        <p>Are you sure?</p>
      </Modal>
    );
    expect(screen.getByRole('dialog', { name: /confirm cancellation/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Table rows and EmptyState cleanly', () => {
    render(
      <Table
        columns={[{ key: 'name', header: 'Name' }]}
        rows={[{ _id: '1', name: 'Dr. Sharma' }]}
      />
    );
    expect(screen.getAllByText('Dr. Sharma').length).toBeGreaterThan(0);

    render(<EmptyState title="No records" description="Upload a record." />);
    expect(screen.getByText('No records')).toBeInTheDocument();
  });
});
