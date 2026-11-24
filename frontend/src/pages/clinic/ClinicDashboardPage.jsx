import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../lib/constants';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingState } from '../../components/ui';

export default function ClinicDashboardPage() {
  const { role, apiFetch } = useAppAuth();
  const [org, setOrg] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClinicPortal = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orgRes = await apiFetch('/organizations/me').catch(() => ({ data: null }));
      const o = orgRes.data?.organization || orgRes.data;
      setOrg(o);
      if (o?._id) {
        const cRes = await apiFetch(`/organizations/${o._id}/clinics`).catch(() => ({ data: { clinics: [] } }));
        setClinics(cRes.data?.clinics || cRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Unable to load clinic workspace.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadClinicPortal();
  }, [loadClinicPortal]);

  if (loading) return <LoadingState rows={3} label="Loading clinic workspace..." />;
  if (error) return <ErrorState title="Clinic portal unavailable" message={error} onRetry={loadClinicPortal} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{org?.name || 'Clinic Workspace'}</h1>
          <p className="text-sm text-slate-600 mt-0.5">Signed in as {ROLE_LABELS[role] || role}</p>
        </div>
        {role === 'CLINIC_MANAGER' && (
          <Link to="/clinic/staff">
            <Button size="sm">
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>Manage Staff</span>
            </Button>
          </Link>
        )}
      </div>

      {clinics.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clinics linked to this organization"
          description="Your organization's clinics will appear here once configured."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clinics.map((c) => (
            <Card key={c._id}>
              <CardHeader title={c.name} description={c.city || c.address?.city} action={<Badge status={c.verificationStatus || 'ACTIVE'} />} />
              <CardBody className="text-sm text-slate-600">
                Clinic ID: <span className="font-mono text-xs">{c._id}</span>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
