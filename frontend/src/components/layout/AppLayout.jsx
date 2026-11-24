import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Show, UserButton } from '@clerk/react';
import {
  Activity,
  Bell,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAppAuth } from '../../context/AuthContext';
import { ROLES, ROLE_LABELS, getDashboardPathForRole } from '../../lib/constants';
import { Button } from '../ui';

const NAV_BY_ROLE = {
  [ROLES.PATIENT]: [
    { to: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/doctors', label: 'Find Doctors', icon: Stethoscope },
    { to: '/patient/appointments', label: 'Appointments', icon: Calendar },
    { to: '/patient/records', label: 'Medical Records', icon: FileText },
    { to: '/patient/prescriptions', label: 'Prescriptions', icon: ClipboardList },
    { to: '/patient/payments', label: 'Payments', icon: CreditCard },
    { to: '/patient/abdm', label: 'ABHA & Consent', icon: ShieldCheck },
    { to: '/patient/notifications', label: 'Notifications', icon: Bell },
    { to: '/patient/profile', label: 'Profile & Settings', icon: UserCog },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
  [ROLES.DOCTOR]: [
    { to: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/doctor/appointments', label: 'Appointments', icon: Calendar },
    { to: '/doctor/queue', label: 'Live Queue', icon: Users },
    { to: '/doctor/prescriptions', label: 'Prescriptions', icon: ClipboardList },
    { to: '/doctor/practice', label: 'Practice & Types', icon: Stethoscope },
    { to: '/doctor/onboarding', label: 'Verification & Onboarding', icon: UserCheck },
    { to: '/doctor/profile', label: 'Profile & Calendly', icon: UserCog },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
  [ROLES.ADMIN]: [
    { to: '/admin/dashboard', label: 'Admin Overview', icon: LayoutDashboard },
    { to: '/admin/applications', label: 'Doctor Applications', icon: UserCheck },
    { to: '/admin/doctors', label: 'Doctors Directory', icon: Stethoscope },
    { to: '/admin/clinics', label: 'Clinics', icon: Building2 },
    { to: '/admin/reviews', label: 'Reviews Moderation', icon: ClipboardList },
    { to: '/admin/support', label: 'Support Tickets', icon: HelpCircle },
    { to: '/admin/abdm', label: 'ABDM Status', icon: ShieldCheck },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
    { to: '/admin/system-health', label: 'System Health', icon: Activity },
  ],
  [ROLES.CLINIC_MANAGER]: [
    { to: '/clinic/dashboard', label: 'Clinic Dashboard', icon: LayoutDashboard },
    { to: '/clinic/staff', label: 'Staff Management', icon: Users },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/clinic/dashboard', label: 'Clinic Desk', icon: LayoutDashboard },
    { to: '/support', label: 'Support', icon: HelpCircle },
  ],
};

const PORTAL_PREFIXES = ['/patient', '/doctor', '/admin', '/clinic', '/support', '/consultation'];

export function AppLayout() {
  const { isSignedIn, role, needsOnboarding } = useAppAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const roleNav = role ? NAV_BY_ROLE[role] || [] : [];
  const isPortalRoute = PORTAL_PREFIXES.some((p) => location.pathname.startsWith(p));
  const showSidebar = isSignedIn && roleNav.length > 0 && isPortalRoute;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1C1917]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-xs border-b border-[#E6E0D4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 sm:h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-md text-[#1C1917] hover:bg-[#F3EFE6] transition-colors"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <Link
              to="/"
              className="font-editorial text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-[#1C1917] focus-visible:outline-none"
            >
              MediBook
            </Link>
          </div>

          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-8 text-sm text-[#44403C]">
            <Link to="/doctors" className="hover:text-[#1B4332] transition-colors">
              Discover Doctors
            </Link>
            <Link to="/#how-it-works" className="hover:text-[#1B4332] transition-colors">
              How It Works
            </Link>
            <Link to="/onboarding" className="hover:text-[#1B4332] transition-colors">
              For Doctors
            </Link>
            <Link to="/#about" className="hover:text-[#1B4332] transition-colors">
              About
            </Link>
            <Show when="signed-in">
              {needsOnboarding ? (
                <Link to="/onboarding" className="font-medium text-[#1B4332] hover:underline underline-offset-4">
                  Complete Setup
                </Link>
              ) : (
                role && (
                  <Link
                    to={getDashboardPathForRole(role)}
                    className="font-medium text-[#1B4332] hover:underline underline-offset-4"
                  >
                    {ROLE_LABELS[role] || 'Dashboard'}
                  </Link>
                )
              )}
            </Show>
          </nav>

          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link to="/sign-in" className="hidden sm:inline-block text-sm text-[#44403C] hover:text-[#1C1917] px-2 py-1">
                Sign In
              </Link>
              <Link to="/doctors">
                <Button variant="primary" size="sm">
                  Book an Appointment
                </Button>
              </Link>
            </Show>
            <Show when="signed-in">
              {role && (
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-[#F3EFE6] text-[#1B4332] border border-[#D6CFC2]">
                  {ROLE_LABELS[role]}
                </span>
              )}
              <UserButton afterSignOutUrl="/" />
            </Show>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-[#1C1917]/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside
            aria-label="Mobile navigation"
            className="w-76 max-w-[85vw] h-full bg-[#FAF7F2] border-r border-[#E6E0D4] flex flex-col"
          >
            <div className="h-16 px-5 border-b border-[#E6E0D4] flex items-center justify-between">
              <span className="font-editorial text-xl font-semibold text-[#1C1917]">MediBook</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-md text-[#57534E] hover:bg-[#F3EFE6]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="p-4 space-y-1 overflow-y-auto flex-1 text-sm">
              <Link to="/doctors" className="block px-3 py-2.5 rounded-md text-[#1C1917] hover:bg-[#F3EFE6]">
                Discover Doctors
              </Link>
              <Link to="/#how-it-works" className="block px-3 py-2.5 rounded-md text-[#1C1917] hover:bg-[#F3EFE6]">
                How It Works
              </Link>
              <Link to="/onboarding" className="block px-3 py-2.5 rounded-md text-[#1C1917] hover:bg-[#F3EFE6]">
                For Doctors
              </Link>
              <Link to="/#about" className="block px-3 py-2.5 rounded-md text-[#1C1917] hover:bg-[#F3EFE6]">
                About
              </Link>
              <Show when="signed-out">
                <Link to="/sign-in" className="block px-3 py-2.5 rounded-md font-medium text-[#1B4332] hover:bg-[#F3EFE6]">
                  Sign In
                </Link>
              </Show>

              {showSidebar && (
                <div className="pt-4 mt-4 border-t border-[#E6E0D4] space-y-1">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
                    Workspace
                  </p>
                  {roleNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                            isActive ? 'bg-[#1B4332] text-[#FAF7F2]' : 'text-[#44403C] hover:bg-[#F3EFE6]'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex-1 w-full flex">
        {showSidebar && (
          <aside
            aria-label="Portal navigation"
            className="hidden lg:block w-64 shrink-0 border-r border-[#E6E0D4] bg-[#F3EFE6]/50 p-5"
          >
            <nav className="space-y-1 sticky top-24">
              {roleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#1B4332] text-[#FAF7F2]'
                          : 'text-[#44403C] hover:bg-[#EFEAE0]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        )}

        <main
          id="main-content"
          className={`flex-1 min-w-0 ${isPortalRoute ? 'max-w-6xl mx-auto p-4 sm:p-6 lg:p-10' : ''}`}
        >
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-[#E6E0D4] bg-[#FAF7F2] py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="font-editorial text-xl font-semibold text-[#1C1917]">MediBook</span>
            <p className="text-xs text-[#57534E]">
              Thoughtful doctor discovery, appointments, and digital care records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-[#57534E]">
            <Link to="/doctors" className="hover:text-[#1B4332] transition-colors">
              Discover Doctors
            </Link>
            <Link to="/#how-it-works" className="hover:text-[#1B4332] transition-colors">
              How It Works
            </Link>
            <Link to="/onboarding" className="hover:text-[#1B4332] transition-colors">
              For Doctors
            </Link>
            <Link to="/support" className="hover:text-[#1B4332] transition-colors">
              Support
            </Link>
            <span>© {new Date().getFullYear()} MediBook</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
