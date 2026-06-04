import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';

interface LoginForm { email: string; password: string; }

export function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>();
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      const res = await api.post('/auth/login', data);
      setAuth(res.data.user, res.data.accessToken);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f5f6fa' }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f1f18 0%, #1F5C45 60%, #2d7a56 100%)' }}
      >
        {/* decorative circles */}
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute right-10 bottom-20 w-24 h-24 rounded-full bg-[#C9A24B]/20" />

        <div className="relative text-center max-w-xs">
          <div className="text-6xl mb-6">🌿</div>
          <h1 className="text-3xl font-display font-bold text-white leading-tight mb-3">
            Nahata Lawns
          </h1>
          <p className="text-white/60 text-base leading-relaxed">
            Lead Management & CRM Platform
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Capture every enquiry automatically',
              'Auto WhatsApp follow-ups',
              'AI call scoring & insights',
              'Live pipeline & analytics',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/70 text-sm">
                <span className="w-5 h-5 rounded-full bg-[#C9A24B]/30 flex items-center justify-center text-[#C9A24B] text-xs flex-shrink-0">✓</span>
                {f}
              </div>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-10">
            Build · Automate · Grow — Anantkamal Software Labs
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-4xl mb-2">🌿</div>
            <h1 className="text-2xl font-display font-bold text-[#1F5C45]">Nahata Lawns</h1>
            <p className="text-slate-500 text-sm mt-1">CRM Platform</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
            <h2 className="text-xl font-display font-bold text-slate-900 mb-1.5">Welcome back</h2>
            <p className="text-slate-600 text-sm mb-6">Sign in to your account</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <Input
                  type="email"
                  placeholder="owner@nahatalawns.com"
                  className="h-11 rounded-xl border-slate-200 text-base"
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="h-11 rounded-xl border-slate-200 text-base pr-10"
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600 font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-base font-semibold bg-[#1F5C45] hover:bg-[#143d2e] mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in…' : 'Sign In →'}
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Demo: <span className="font-mono text-slate-500">owner@nahatalawns.com</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Password: <span className="font-mono text-slate-500">NahataOwner2024!</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
