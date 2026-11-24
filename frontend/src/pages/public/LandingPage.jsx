import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowDown, ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { apiRequest, buildQuery } from '../../lib/api';
import { useAppAuth } from '../../context/AuthContext';
import { formatCurrency, getDashboardPathForRole } from '../../lib/constants';
import { Avatar, Badge, Button } from '../../components/ui';

const JOURNEY_STEPS = [
  {
    num: '01',
    title: 'Discover the right doctor.',
    body: 'Browse verified practitioners by clinical specialty, city, and consultation format.',
  },
  {
    num: '02',
    title: 'Choose an available appointment.',
    body: 'Inspect transparent consultation fees, clinic locations, and live open time slots.',
  },
  {
    num: '03',
    title: 'Attend your consultation.',
    body: 'Visit the clinic with live queue tracking or join an encrypted video room from anywhere.',
  },
  {
    num: '04',
    title: 'Manage your healthcare records.',
    body: 'Download signed prescriptions and decide exactly which doctors can access your records.',
  },
];

const CAPABILITIES = [
  {
    code: 'SCHEDULING',
    title: 'Online & In-Clinic Appointments',
    detail: 'Timezone-aware slot booking with Calendly sync and instant confirmation.',
  },
  {
    code: 'TELEHEALTH',
    title: 'Encrypted Video Consultations',
    detail: 'Browser-native video sessions powered by short-lived Agora tokens.',
  },
  {
    code: 'CLINICAL',
    title: 'Digital Prescriptions & PDFs',
    detail: 'Structured medication guidance issued directly by your treating physician.',
  },
  {
    code: 'PRIVACY',
    title: 'Patient-Controlled Health Records',
    detail: 'Upload reports, grant or revoke doctor access, and manage ABDM consent.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, role, needsOnboarding } = useAppAuth();

  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [mode, setMode] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest(`/doctors${buildQuery({ limit: 4 })}`)
      .then((res) => {
        if (!active) return;
        const list = res.data?.doctors || res.data?.items || res.data || [];
        setDoctors(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setDoctors([]);
      })
      .finally(() => {
        if (active) setLoadingDoctors(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDiscoverySubmit = (e) => {
    e.preventDefault();
    const qs = buildQuery({
      q: query.trim() || undefined,
      specialty: specialty.trim() || undefined,
      city: city.trim() || undefined,
      mode: mode || undefined,
    });
    navigate(`/doctors${qs}`);
  };

  return (
    <div className="bg-[#F7F5F0] text-[#171916]">
      {/* 1. Immersive Full-Bleed Editorial Hero */}
      <section className="relative min-h-[82vh] flex items-end overflow-hidden bg-[#171916]">
        <img
          src="/images/hero-clinic.jpg"
          alt="Physician listening attentively to a patient in a sunlit architectural clinic"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#171916]/90 via-[#171916]/45 to-[#171916]/20"
        />

        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 pt-24 pb-12 sm:pb-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-8 space-y-6"
            >
              <p className="font-mono-label text-[11px] uppercase tracking-[0.22em] text-[#D9D5CA]">
                A MORE THOUGHTFUL APPROACH TO HEALTHCARE
              </p>
              <h1 className="font-editorial text-5xl sm:text-6xl lg:text-[4.75rem] font-normal leading-[1.02] tracking-[-0.02em] text-[#F7F5F0]">
                Care that begins
                <br />
                with <span className="italic text-[#D9D5CA]">understanding.</span>
              </h1>
              <p className="text-base sm:text-lg text-[#D9D5CA] leading-relaxed max-w-xl">
                Discover trusted doctors, find the right specialist, and manage every step of your healthcare journey in one considered experience.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link to="/doctors">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2.5 h-12 px-6 rounded-sm bg-[#F7F5F0] text-[#171916] text-sm font-medium hover:bg-white transition-colors cursor-pointer"
                  >
                    <span>Discover a Doctor</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </Link>
                <a
                  href="#discover"
                  className="inline-flex items-center h-12 px-6 rounded-sm border border-[#F7F5F0]/40 text-sm font-medium text-[#F7F5F0] hover:bg-[#F7F5F0]/10 transition-colors"
                >
                  Explore DocCop
                </a>
                {isSignedIn && needsOnboarding && (
                  <Link to="/onboarding" className="text-sm text-[#F7F5F0] underline underline-offset-4">
                    Complete Setup
                  </Link>
                )}
                {isSignedIn && !needsOnboarding && role && (
                  <Link to={getDashboardPathForRole(role)} className="text-sm text-[#F7F5F0] underline underline-offset-4">
                    Open Workspace
                  </Link>
                )}
              </div>
            </motion.div>

            <div className="lg:col-span-4 hidden lg:flex justify-end">
              <a
                href="#discover"
                className="inline-flex items-center gap-2 font-mono-label text-[11px] uppercase tracking-[0.2em] text-[#D9D5CA] hover:text-white transition-colors"
              >
                <span>Scroll to explore</span>
                <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Editorial Doctor Discovery */}
      <section id="discover" className="bg-[#F7F5F0] py-20 lg:py-28 border-b border-[#D9D5CA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 space-y-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7 space-y-3">
              <p className="font-mono-label text-[11px] uppercase tracking-[0.2em] text-[#777C68]">
                01 / Doctor Discovery
              </p>
              <h2 className="font-editorial text-4xl sm:text-5xl font-normal tracking-[-0.02em] text-[#171916]">
                Better care starts with the right connection.
              </h2>
            </div>
            <div className="lg:col-span-5 lg:text-right">
              <Link
                to="/doctors"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#183F32] hover:underline underline-offset-4"
              >
                <span>View complete verified directory</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Minimalist Architectural Search Bar (underlined, no boxed container) */}
          <form
            onSubmit={handleDiscoverySubmit}
            role="search"
            aria-label="Search doctors"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 items-end pb-8 border-b border-[#D9D5CA]"
          >
            <div className="lg:col-span-4">
              <label htmlFor="home-q" className="block font-mono-label text-[10px] uppercase tracking-[0.18em] text-[#777C68] mb-2">
                Practitioner or Keyword
              </label>
              <input
                id="home-q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, condition, or clinic"
                className="w-full h-11 bg-transparent border-b border-[#171916]/30 focus:border-[#183F32] text-sm text-[#171916] placeholder:text-[#777C68] focus:outline-none"
              />
            </div>
            <div className="lg:col-span-3">
              <label htmlFor="home-specialty" className="block font-mono-label text-[10px] uppercase tracking-[0.18em] text-[#777C68] mb-2">
                Specialty
              </label>
              <input
                id="home-specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Cardiology"
                className="w-full h-11 bg-transparent border-b border-[#171916]/30 focus:border-[#183F32] text-sm text-[#171916] placeholder:text-[#777C68] focus:outline-none"
              />
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="home-city" className="block font-mono-label text-[10px] uppercase tracking-[0.18em] text-[#777C68] mb-2">
                City
              </label>
              <input
                id="home-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bengaluru"
                className="w-full h-11 bg-transparent border-b border-[#171916]/30 focus:border-[#183F32] text-sm text-[#171916] placeholder:text-[#777C68] focus:outline-none"
              />
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="home-mode" className="block font-mono-label text-[10px] uppercase tracking-[0.18em] text-[#777C68] mb-2">
                Format
              </label>
              <select
                id="home-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full h-11 bg-transparent border-b border-[#171916]/30 focus:border-[#183F32] text-sm text-[#171916] focus:outline-none"
              >
                <option value="">All formats</option>
                <option value="IN_PERSON">In-person</option>
                <option value="VIDEO">Video consult</option>
              </select>
            </div>
            <div className="lg:col-span-1">
              <Button type="submit" className="w-full h-11" aria-label="Search doctors">
                <Search className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </form>

          {/* Featured Doctors (real API data only) */}
          {loadingDoctors ? (
            <p className="text-sm text-[#777C68]">Loading verified practitioners...</p>
          ) : doctors.length === 0 ? (
            <div className="py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-[#777C68]">
                Approved practitioners appear here automatically once verified by DocCop administration.
              </p>
              <Link to="/doctors">
                <Button variant="outline" size="sm">Open Directory</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#D9D5CA]">
              {doctors.map((doc, idx) => {
                const name = doc.fullName || doc.user?.fullName || 'Doctor';
                const specs = Array.isArray(doc.specialties)
                  ? doc.specialties.join(', ')
                  : doc.specialty || 'Specialist';
                return (
                  <div
                    key={doc._id}
                    className="py-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
                  >
                    <div className="md:col-span-1 font-mono-label text-xs text-[#A87957]">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="md:col-span-6 flex items-center gap-4 min-w-0">
                      <Avatar name={name} src={doc.profileImage} size="lg" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-editorial text-2xl sm:text-3xl font-normal text-[#171916]">
                            {name}
                          </h3>
                          <Badge status="VERIFIED" />
                        </div>
                        <p className="text-sm text-[#777C68] mt-0.5">
                          {specs}
                          {doc.primaryClinic?.city ? ` — ${doc.primaryClinic.city}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="md:col-span-3 text-sm text-[#444640]">
                      {doc.consultationFee != null ? `${formatCurrency(doc.consultationFee)} consultation` : 'See profile for fee'}
                    </div>
                    <div className="md:col-span-2 md:text-right">
                      <Link to={`/doctors/${doc._id}`}>
                        <Button variant="outline" size="sm">View &amp; Book</Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. Deep Ink Editorial Band — How DocCop Works */}
      <section id="how-it-works" className="bg-[#171916] text-[#F7F5F0] py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <p className="font-mono-label text-[11px] uppercase tracking-[0.2em] text-[#A87957]">
              02 / Patient Journey
            </p>
            <h2 className="font-editorial text-4xl sm:text-5xl font-normal tracking-[-0.02em] leading-[1.08]">
              A calmer rhythm from discovery to follow-up.
            </h2>
            <div className="overflow-hidden rounded-sm border border-[#F7F5F0]/15">
              <img
                src="/images/editorial-space.jpg"
                alt="Serene sunlit medical reception lounge with limestone and natural greenery"
                loading="lazy"
                className="w-full h-72 sm:h-80 object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-7 divide-y divide-[#F7F5F0]/15 border-t border-b border-[#F7F5F0]/15">
            {JOURNEY_STEPS.map((step) => (
              <div key={step.num} className="py-8 grid grid-cols-1 sm:grid-cols-12 gap-3 items-baseline">
                <span className="sm:col-span-2 font-mono-label text-xs text-[#A87957]">{step.num}</span>
                <div className="sm:col-span-10 space-y-2">
                  <h3 className="font-editorial text-2xl sm:text-3xl font-normal text-[#F7F5F0]">
                    {step.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[#D9D5CA]/80 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Asymmetric Capabilities Band */}
      <section id="about" className="bg-white py-20 lg:py-28 border-b border-[#D9D5CA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 space-y-4">
            <p className="font-mono-label text-[11px] uppercase tracking-[0.2em] text-[#777C68]">
              03 / Clinical Continuity
            </p>
            <h2 className="font-editorial text-4xl sm:text-5xl font-normal tracking-[-0.02em] text-[#171916]">
              Built for privacy, clarity, and trust.
            </h2>
            <p className="text-sm sm:text-base text-[#444640] leading-relaxed">
              Every appointment, prescription, and medical record on DocCop is governed by strict role-based access and patient consent.
            </p>
          </div>

          <div className="lg:col-span-7 divide-y divide-[#D9D5CA] border-t border-b border-[#D9D5CA]">
            {CAPABILITIES.map((cap) => (
              <div key={cap.code} className="py-6 grid grid-cols-1 sm:grid-cols-12 gap-2 items-baseline">
                <span className="sm:col-span-3 font-mono-label text-[11px] uppercase tracking-[0.16em] text-[#183F32]">
                  {cap.code}
                </span>
                <div className="sm:col-span-9 space-y-1">
                  <h3 className="text-base font-medium text-[#171916]">{cap.title}</h3>
                  <p className="text-sm text-[#444640] leading-relaxed">{cap.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Integrated Editorial Closing Section */}
      <section className="bg-[#F7F5F0] py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="font-mono-label text-[11px] uppercase tracking-[0.2em] text-[#A87957]">
              Begin Today
            </p>
            <h2 className="font-editorial text-4xl sm:text-6xl font-normal leading-[1.06] tracking-[-0.02em] text-[#171916]">
              Your health deserves a better experience.
            </h2>
            <div className="pt-2">
              <Link to={isSignedIn ? (role ? getDashboardPathForRole(role) : '/onboarding') : '/sign-up'}>
                <Button size="lg" variant="primary">
                  <span>Start Your Journey</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-sm border border-[#D9D5CA]">
              <img
                src="/images/editorial-space.jpg"
                alt="Warm architectural clinic interior"
                loading="lazy"
                className="w-full h-64 sm:h-72 object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
