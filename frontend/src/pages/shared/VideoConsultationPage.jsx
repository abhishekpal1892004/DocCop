import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Video } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { Alert, Badge, Button, Card, CardBody, CardHeader, ErrorState, LoadingState } from '../../components/ui';

export default function VideoConsultationPage() {
  const { appointmentId } = useParams();
  const { apiFetch } = useAppAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/video-consultations/${appointmentId}/token`, { method: 'POST' });
      setSession(res.data);
    } catch (err) {
      setError(err.message || 'Video consultation is not available for this appointment yet.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, appointmentId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) return <LoadingState rows={2} label="Preparing encrypted video room..." />;
  if (error) return <ErrorState title="Video Room Unavailable" message={error} onRetry={loadSession} />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader
          title="Teleconsultation Room"
          description={`Appointment ID: ${appointmentId}`}
          action={<Badge status="ACTIVE">Agora Encrypted</Badge>}
        />
        <CardBody className="space-y-4">
          <Alert variant="info" title="Session Ready">
            Channel: <span className="font-mono">{session?.channelName || 'medibook-room'}</span> • UID:{' '}
            <span className="font-mono">{session?.uid ?? 'assigned'}</span>
          </Alert>
          <div className="aspect-video rounded-xl bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-6 text-center gap-3">
            <Video className="w-10 h-10 text-teal-400" aria-hidden="true" />
            <p className="text-sm max-w-md">
              Your short-lived Agora RTC token has been issued securely. Connect your camera & microphone to start the consultation.
            </p>
            <Button variant="primary" onClick={loadSession}>
              Refresh Session Token
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
