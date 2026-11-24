import { useCallback, useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { Badge, Button, ConfirmationDialog, ErrorState, LoadingState, Table, useToast } from '../../components/ui';

export default function AdminDoctorsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/doctors');
      setDoctors(res.data?.doctors || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load doctors.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const toggleStatus = async () => {
    if (!target) return;
    setBusy(true);
    const nextStatus = target.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await apiFetch(`/admin/doctors/${target._id}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      addToast({ variant: 'success', title: `Doctor status updated to ${nextStatus}` });
      setTarget(null);
      loadDoctors();
    } catch (err) {
      addToast({ variant: 'error', title: 'Update failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'fullName', header: 'Doctor', render: (r) => r.fullName || r.user?.fullName || 'Doctor' },
    { key: 'specialties', header: 'Specialties', render: (r) => (Array.isArray(r.specialties) ? r.specialties.join(', ') : '—') },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status || 'ACTIVE'} /> },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => (
        <Button variant="outline" size="sm" onClick={() => setTarget(r)}>
          {r.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manage Doctors</h1>
        <p className="text-sm text-slate-600 mt-0.5">Monitor active doctors and suspend or reactivate listings.</p>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading doctors..." />
      ) : error ? (
        <ErrorState title="Could not load doctors" message={error} onRetry={loadDoctors} />
      ) : (
        <Table columns={columns} rows={doctors} />
      )}

      <ConfirmationDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={toggleStatus}
        loading={busy}
        title={target?.status === 'SUSPENDED' ? 'Reactivate doctor?' : 'Suspend doctor?'}
        description="This immediately updates their visibility in the public directory."
        confirmLabel={target?.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
      />
    </div>
  );
}
