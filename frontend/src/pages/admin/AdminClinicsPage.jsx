import { useCallback, useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { Badge, Button, ErrorState, LoadingState, Table, useToast } from '../../components/ui';

export default function AdminClinicsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/clinics');
      setClinics(res.data?.clinics || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load clinics.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  const handleVerify = async (clinic) => {
    try {
      await apiFetch(`/admin/clinics/${clinic._id}/verify`, {
        method: 'PATCH',
        body: { status: 'VERIFIED' },
      });
      addToast({ variant: 'success', title: 'Clinic verified' });
      loadClinics();
    } catch (err) {
      addToast({ variant: 'error', title: 'Verification failed', description: err.message });
    }
  };

  const columns = [
    { key: 'name', header: 'Clinic Name' },
    { key: 'city', header: 'City', render: (r) => r.city || r.address?.city || '—' },
    { key: 'status', header: 'Verification', render: (r) => <Badge status={r.verificationStatus || r.status || 'PENDING'} /> },
    {
      key: 'actions',
      header: 'Action',
      render: (r) =>
        r.verificationStatus !== 'VERIFIED' ? (
          <Button size="sm" onClick={() => handleVerify(r)}>
            Verify Clinic
          </Button>
        ) : (
          <span className="text-xs text-slate-400">Verified</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clinics Management</h1>
        <p className="text-sm text-slate-600 mt-0.5">Verify registered healthcare facilities.</p>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading clinics..." />
      ) : error ? (
        <ErrorState title="Could not load clinics" message={error} onRetry={loadClinics} />
      ) : (
        <Table columns={columns} rows={clinics} />
      )}
    </div>
  );
}
