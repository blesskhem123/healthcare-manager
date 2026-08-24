import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, LogOut, User, Shield, CalendarCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleColors = {
    PATIENT: 'bg-sky-100 text-sky-800 border-sky-300',
    DOCTOR: 'bg-teal-100 text-teal-800 border-teal-300',
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-300'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-600 rounded-lg text-white">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">HealthCare Manager</h1>
            <p className="text-xs text-slate-500">Appointment & Follow-up Platform</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${roleColors[user.role]}`}>
            {user.role === 'ADMIN' && <Shield className="w-3.5 h-3.5 mr-1" />}
            {user.role === 'DOCTOR' && <Stethoscope className="w-3.5 h-3.5 mr-1" />}
            {user.role === 'PATIENT' && <CalendarCheck className="w-3.5 h-3.5 mr-1" />}
            {user.role}
          </span>

          <div className="flex items-center space-x-2 text-slate-700 text-sm font-medium">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
              <User className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline">{user.name}</span>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-1 text-xs font-medium text-slate-600 hover:text-rose-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
