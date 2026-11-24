import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { apiRequest } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [profile, setProfile] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const token = isSignedIn ? await getToken() : null;
      return apiRequest(path, { ...options, token });
    },
    [isSignedIn, getToken]
  );

  const refreshUser = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfile(null);
      setNeedsOnboarding(false);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/users/me');
      setProfile(res.data?.user || res.data || null);
      setNeedsOnboarding(false);
    } catch (err) {
      if (err.status === 404) {
        setProfile(null);
        setNeedsOnboarding(true);
      } else {
        setError(err.message || 'Unable to load your account.');
      }
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, apiFetch]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        isLoaded,
        isSignedIn,
        clerkUser,
        user: profile,
        role: profile?.role || null,
        needsOnboarding,
        loading,
        error,
        refreshUser,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAppAuth must be used within AuthProvider');
  }
  return ctx;
}
