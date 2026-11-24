import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  LoadingState,
  Select,
  useToast,
} from '../../components/ui';

export default function ClinicStaffPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [clinicId, setClinicId] = useState('');
  const [staff, setStaff] = useState([]);
  const [email, setEmail] = useState('');
  const [staffRole, setStaffRole] = useState('RECEPTIONIST');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orgRes = await apiFetch('/organizations/me');
      const orgId = orgRes.data?.organization?._id || orgRes.data?._id;
      if (orgId) {
        const cRes = await apiFetch(`/organizations/${orgId}/clinics`);
        const firstClinic = (cRes.data?.clinics || cRes.data || [])[0];
        if (firstClinic?._id) {
          setClinicId(firstClinic._id);
          const sRes = await apiFetch(`/clinics/${firstClinic._id}/staff`);
          setStaff(sRes.data?.staff || sRes.data || []);
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to load clinic staff.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!clinicId) return;
    setBusy(true);
    try {
      await apiFetch(`/clinics/${clinicId}/staff/invite`, {
        method: 'POST',
        body: { email: email.trim(), role: staffRole },
      });
      addToast({ variant: 'success', title: 'Staff invitation sent' });
      setEmail('');
      loadStaff();
    } catch (err) {
      addToast({ variant: 'error', title: 'Invitation failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading clinic staff..." />;
  if (error) return <ErrorState message={error} onRetry={loadStaff} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clinic Staff Management</h1>
        <p className="text-sm text-slate-600 mt-0.5">Invite receptionists or clinic managers scoped to your clinic.</p>
      </div>

      {clinicId && (
        <Card>
          <CardHeader title="Invite Staff Member" />
          <CardBody>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-end">
              <Input
                label="Email address"
                type="email"
                required
                wrapperClassName="flex-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@clinic.in"
              />
              <Select
                label="Role"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                options={[
                  { value: 'RECEPTIONIST', label: 'Receptionist' },
                  { value: 'CLINIC_MANAGER', label: 'Clinic Manager' },
                ]}
              />
              <Button type="submit" loading={busy}>
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Send Invite</span>
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Current Staff" />
        <CardBody>
          {staff.length === 0 ? (
            <p className="text-sm text-slate-500">No staff members found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {staff.map((m) => (
                <div key={m._id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{m.fullName || m.email || 'Staff Member'}</p>
                    <p className="text-xs text-slate-500">{m.role}</p>
                  </div>
                  <Badge status={m.status || 'ACTIVE'} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
