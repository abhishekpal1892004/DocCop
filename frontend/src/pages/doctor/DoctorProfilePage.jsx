import { useCallback, useEffect, useState } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
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
  Textarea,
  useToast,
} from '../../components/ui';

const DEFAULT_CALENDLY_URL = 'https://calendly.com/abhishekpal1892004';

export default function DoctorProfilePage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();

  const [bio, setBio] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [calendly, setCalendly] = useState(null);
  const [calendlyLink, setCalendlyLink] = useState(DEFAULT_CALENDLY_URL);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [docRes, calRes] = await Promise.all([
        apiFetch('/doctors/me').catch(() => ({ data: null })),
        apiFetch('/integrations/calendly/status').catch(() => ({ data: null })),
      ]);
      const d = docRes.data?.doctor || docRes.data;
      if (d) {
        setBio(d.bio || '');
        setConsultationFee(d.consultationFee != null ? String(d.consultationFee) : '');
        setExperienceYears(d.experienceYears != null ? String(d.experienceYears) : '');
      }
      const conn = calRes.data?.connection || calRes.data;
      setCalendly(conn);
      if (conn?.schedulingUrl) {
        setCalendlyLink(conn.schedulingUrl);
      }
    } catch (err) {
      setError(err.message || 'Unable to load doctor profile.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleConnectCalendly = async () => {
    setConnecting(true);
    try {
      const res = await apiFetch('/integrations/calendly/connect');
      const authUrl = res.data?.authorizationUrl || res.data?.url;
      if (authUrl) {
        window.location.assign(authUrl);
      } else {
        addToast({ variant: 'error', title: 'Calendly OAuth URL not returned' });
      }
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Calendly OAuth unavailable',
        description: err.message,
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/doctors/me', {
        method: 'PATCH',
        body: {
          bio: bio.trim(),
          ...(consultationFee ? { consultationFee: Number(consultationFee) } : {}),
          ...(experienceYears ? { experienceYears: Number(experienceYears) } : {}),
        },
      });
      addToast({ variant: 'success', title: 'Doctor profile updated' });
    } catch (err) {
      addToast({ variant: 'error', title: 'Update failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState rows={3} label="Loading profile..." />;
  if (error) return <ErrorState title="Profile unavailable" message={error} onRetry={loadProfile} />;

  const isConnected = Boolean(calendly?.connected || calendly?.status === 'CONNECTED');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Doctor Profile & Calendly</h1>
        <p className="text-sm text-slate-600 mt-0.5">Update your public bio, fees, and scheduling integration.</p>
      </div>

      <Card>
        <CardHeader
          title="Calendly Integration"
          action={<Badge status={isConnected ? 'ACTIVE' : 'NOT_STARTED'}>{isConnected ? 'Connected' : 'Not Connected'}</Badge>}
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {isConnected
                ? 'Your Calendly account is synced for real-time slot availability.'
                : 'Connect Calendly OAuth to sync your consultation availability automatically.'}
            </p>
            <Button variant="outline" size="sm" onClick={handleConnectCalendly} loading={connecting}>
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>{isConnected ? 'Reconnect Calendly' : 'Connect Calendly'}</span>
            </Button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-end">
            <Input
              label="Public Calendly Scheduling Link"
              type="url"
              wrapperClassName="flex-1"
              value={calendlyLink}
              onChange={(e) => setCalendlyLink(e.target.value)}
              hint="Direct Calendly booking page (full slot sync requires Calendly OAuth in .env)"
            />
            <a href={calendlyLink} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="md">
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                <span>Open Link</span>
              </Button>
            </a>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Public Practice Profile" />
        <CardBody>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Consultation Fee (INR)"
                type="number"
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
              />
              <Input
                label="Experience (Years)"
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
              />
            </div>
            <Textarea
              label="Professional Bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your clinical background and areas of focus..."
            />
            <Button type="submit" loading={saving}>
              Save Profile
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
