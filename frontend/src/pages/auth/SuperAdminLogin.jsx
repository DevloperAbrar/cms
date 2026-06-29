import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { authApi } from '../../api/auth.api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

const LOGO_URL =
  'https://res.cloudinary.com/dajm37tg0/image/upload/v1782748411/cmapuhub_c1rnxc.png';

const features = [
  { label: 'Attendance & timetable management' },
  { label: 'Marks, results & certificate issuance' },
  { label: 'Parent connect & real-time tracking' },
];

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const user = await authApi.superAdminLogin(data);
      setUser(user);
      toast.success('Welcome, Super Admin!');
      navigate('/superadmin');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* ── LEFT PANEL ── */}
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(160deg, #0a1a4e 0%, #0d2266 60%, #0f2880 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* decorative circles */}
        <div style={{
          position: 'absolute', width: 340, height: 340, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', top: -80, right: -80,
        }} />
        <div style={{
          position: 'absolute', width: 220, height: 220, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)', bottom: 40, right: 60,
        }} />
        <div style={{
          position: 'absolute', width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', bottom: -30, left: 30,
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 400, textAlign: 'center' }}>
          {/* Logo */}
          <img
            src={LOGO_URL}
            alt="CampusHub Logo"
            style={{
              height: 70,
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto 36px auto',
              borderRadius: 12,
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.12)',
            }}
          />

          <h1 style={{
            color: '#fff',
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.25,
            marginBottom: 16,
          }}>
            Campus Management<br />System
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 15,
            lineHeight: 1.7,
            marginBottom: 48,
          }}>
            All-in-one academic platform — manage attendance, marks, results & certificates with real-time parent connect and student progress tracking.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {features.map(({ label }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 50,
                  padding: '12px 20px',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <span style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: '#f97316', flexShrink: 0,
                }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        style={{
          width: 460,
          background: '#f0f4ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Card */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 32px rgba(10,26,78,0.10)',
            padding: '36px 32px',
          }}>
            <h2 style={{
              fontSize: 24, fontWeight: 700,
              color: '#0a1a4e', marginBottom: 4,
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              Sign in to your Super Admin account
            </p>

            {/* Secured badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 8, padding: '10px 14px', marginBottom: 24,
            }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
                  fill="#16a34a" />
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>
                Secured admin access — credentials only
              </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 600,
                  color: '#374151', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 6,
                }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <svg
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
                    width="16" height="16" fill="none" viewBox="0 0 24 24"
                  >
                    <path d="M4 4h16v16H4z" stroke="none" />
                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="#374151" strokeWidth="1.8" />
                    <path d="M2 7l10 7 10-7" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@college.edu"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '11px 12px 11px 38px',
                      border: `1.5px solid ${errors.email ? '#f87171' : '#e5e7eb'}`,
                      borderRadius: 8, fontSize: 14, color: '#111827',
                      outline: 'none', background: '#fafafa',
                      transition: 'border-color .15s',
                    }}
                    {...register('email', { required: 'Email is required' })}
                  />
                </div>
                {errors.email && (
                  <p style={{ marginTop: 4, fontSize: 12, color: '#ef4444' }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 600,
                  color: '#374151', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 6,
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <svg
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
                    width="16" height="16" fill="none" viewBox="0 0 24 24"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="#374151" strokeWidth="1.8" />
                    <path d="M8 11V7a4 4 0 018 0v4" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '11px 40px 11px 38px',
                      border: `1.5px solid ${errors.password ? '#f87171' : '#e5e7eb'}`,
                      borderRadius: 8, fontSize: 14, color: '#111827',
                      outline: 'none', background: '#fafafa',
                      transition: 'border-color .15s',
                    }}
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: '#9ca3af', padding: 0,
                    }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ marginTop: 4, fontSize: 12, color: '#ef4444' }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Sign In button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13px',
                  background: loading ? '#fbbf8a' : '#f97316',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.01em',
                  transition: 'background .15s',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              margin: '20px 0', color: '#9ca3af', fontSize: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              or continue as
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>

            {/* Google login buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Admin Login', href: `${import.meta.env.VITE_API_URL || '/api'}/auth/google?role=admin` },
                { label: 'Student Login', href: `${import.meta.env.VITE_API_URL || '/api'}/auth/google?role=student` },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                    padding: '10px 12px',
                    border: '1.5px solid #e5e7eb', borderRadius: 8,
                    background: '#fff', fontSize: 13, fontWeight: 500,
                    color: '#374151', textDecoration: 'none',
                    transition: 'border-color .15s, box-shadow .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#d1d5db'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <GoogleIcon />
                  {label}
                </a>
              ))}
            </div>

            {/* Footer */}
            <p style={{
              marginTop: 20, textAlign: 'center',
              fontSize: 11, color: '#9ca3af',
            }}>
              CampusDocs · College Certificate Management System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default SuperAdminLogin;