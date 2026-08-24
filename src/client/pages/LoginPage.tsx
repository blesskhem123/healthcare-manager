import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { Stethoscope, Shield, User, Lock, Mail, Phone, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'PATIENT' | 'DOCTOR' | 'ADMIN'>('PATIENT');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('General Medicine');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const data = await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            name,
            role,
            phone,
            specialization: role === 'DOCTOR' ? specialization : undefined
          })
        });
        login(data.token, data.user);
      } else {
        const data = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        login(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: demoEmail, password: 'password123' })
      });
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-sky-600 rounded-xl text-white shadow-md">
            <Stethoscope className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          {isRegister ? 'Create Your Account' : 'Sign in to Healthcare Portal'}
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Manage appointments, AI symptom summaries, & prescriptions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-200 sm:rounded-xl sm:px-10">
          
          {/* Preset Demo Logins */}
          <div className="mb-6 bg-sky-50 border border-sky-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-sky-900 mb-2 flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-sky-600" />
              Quick Demo Logins (1-Click):
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleDemoLogin('john.doe@example.com')}
                className="py-1.5 px-2 bg-white text-sky-700 border border-sky-300 rounded hover:bg-sky-100 transition-colors text-center"
              >
                Patient
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('sarah.jenkins@clinic.com')}
                className="py-1.5 px-2 bg-white text-teal-700 border border-teal-300 rounded hover:bg-teal-100 transition-colors text-center"
              >
                Doctor
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('admin@clinic.com')}
                className="py-1.5 px-2 bg-white text-purple-700 border border-purple-300 rounded hover:bg-purple-100 transition-colors text-center"
              >
                Admin
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2.5 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Full Name</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Account Type</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-slate-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 rounded-lg border"
                  >
                    <option value="PATIENT">Patient</option>
                    <option value="DOCTOR">Doctor</option>
                    <option value="ADMIN">Clinic Admin</option>
                  </select>
                </div>

                {role === 'DOCTOR' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Specialization</label>
                    <input
                      type="text"
                      required
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="Cardiology, Dermatology..."
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone Number (Optional)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555-0199"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700">Email Address</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center border-t border-slate-200 pt-4">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(null); }}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
