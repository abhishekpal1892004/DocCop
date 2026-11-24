import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/constants';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  LoadingState,
  useToast,
} from '../../components/ui';

export default function PatientNotificationsPage() {
  const { apiFetch } = useAppAuth();
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/notifications/my');
      setNotifications(res.data?.notifications || res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      addToast({ variant: 'error', title: 'Update failed', description: err.message });
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      addToast({ variant: 'success', title: 'All notifications marked as read' });
    } catch (err) {
      addToast({ variant: 'error', title: 'Update failed', description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-600 mt-0.5">Appointment updates, reminders, and clinical alerts.</p>
        </div>
        {notifications.length > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            <span>Mark all read</span>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState rows={3} label="Loading notifications..." />
      ) : error ? (
        <ErrorState title="Could not load notifications" message={error} onRetry={loadNotifications} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New appointment and prescription notifications will appear here."
        />
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => (
            <Card key={n._id} className={n.isRead ? 'opacity-80' : 'border-teal-300'}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{n.title || n.type || 'Notification'}</h2>
                    {!n.isRead && <Badge tone="info">New</Badge>}
                  </div>
                  <p className="text-sm text-slate-600">{n.message || n.body}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" size="sm" onClick={() => markRead(n._id)}>
                    Mark read
                  </Button>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
