import { useCallback, useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../lib/constants';
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Table,
} from '../../components/ui';

export default function PatientPaymentsPage() {
  const { apiFetch } = useAppAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/payments/my');
      setPayments(res.data?.payments || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load payment history.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const columns = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatCurrency((row.amountPaise ?? (row.amount != null ? row.amount * 100 : 0)) / 100, row.currency || 'INR'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'razorpayOrderId',
      header: 'Reference',
      render: (row) => <span className="font-mono text-xs">{row.razorpayPaymentId || row.razorpayOrderId || row._id}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments & Receipts</h1>
        <p className="text-sm text-slate-600 mt-0.5">Track consultation payments, statuses, and transaction references.</p>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading payments..." />
      ) : error ? (
        <ErrorState title="Could not load payments" message={error} onRetry={loadPayments} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment transactions yet"
          description="Payments for paid consultations will appear here."
        />
      ) : (
        <Table columns={columns} rows={payments} />
      )}
    </div>
  );
}
