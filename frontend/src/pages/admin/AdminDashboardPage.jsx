import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Building2, ShieldCheck, Stethoscope, UserCheck } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { Button, Card, CardBody, CardHeader, ErrorState, LoadingState } from '../../components/ui';

export default function AdminDashboardPage() {
  const { apiFetch } = useAppAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/dashboard');
      setStats(res.data);
    } catch (err) {
      setError(err.message || 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) return <LoadingState rows={4} label="Loading admin overview..." />;
  if (error) return <ErrorState title="Admin dashboard unavailable" message={error} onRetry={loadStats} />;

  const metrics = [
    { label: 'Pending Applications', value: stats?.pendingApplications ?? stats?.applicationsPending ?? 0, icon: UserCheck, to: '/admin/applications' },
    { label: 'Verified Doctors', value: stats?.approvedDoctors ?? stats?.totalDoctors ?? 0, icon: Stethoscope, to: '/admin/doctors' },
    { label: 'Registered Clinics', value: stats?.totalClinics ?? 0, icon: Building2, to: '/admin/clinics' },
    { label: 'System Health', value: 'Monitor', icon: Activity, to: '/admin/system-health' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
        <p className="text-sm text-slate-600 mt-0.5">Platform governance, doctor verification, clinics, and operational health.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label}>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{m.label}</span>
                  <Icon className="w-4 h-4 text-teal-700" aria-hidden="true" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{m.value}</p>
                <Link to={m.to} className="text-xs font-semibold text-teal-700 hover:underline inline-block">
                  Open →
                </Link>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Governance Shortcuts" />
        <CardBody className="flex flex-wrap gap-3">
          <Link to="/admin/applications"><Button variant="outline" size="sm">Review Doctor Applications</Button></Link>
          <Link to="/admin/reviews"><Button variant="outline" size="sm">Moderate Reviews</Button></Link>
          <Link to="/admin/support"><Button variant="outline" size="sm">Support Tickets</Button></Link>
          <Link to="/admin/abdm"><Button variant="outline" size="sm"><ShieldCheck className="w-4 h-4" aria-hidden="true" /><span>ABDM Status</span></Button></Link>
          <Link to="/admin/audit-logs"><Button variant="outline" size="sm">Audit Logs</Button></Link>
        </CardBody>
      </Card>
    </div>
  );
}
