import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { Shield, UserPlus, Calendar, Clock, Stethoscope, AlertTriangle, CheckCircle2, Users, FileText, Bell } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DOCTORS' | 'LEAVES' | 'STATS'>('DOCTORS');

  // Doctor List & Creation state
  const [doctors, setDoctors] = useState<any[]>([]);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('password123');
  const [docSpecialization, setDocSpecialization] = useState('General Medicine');
  const [docBio, setDocBio] = useState('');
  const [docStartHours, setDocStartHours] = useState('09:00');
  const [docEndHours, setDocEndHours] = useState('17:00');
  const [docSlotDuration, setDocSlotDuration] = useState(30);

  // Leave Management State
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveResult, setLeaveResult] = useState<any | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Stats State
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    fetchDoctors();
    fetchStats();
  }, []);

  const fetchDoctors = async () => {
    try {
      const data = await apiRequest('/admin/doctors');
      setDoctors(data.doctors || []);
      if (data.doctors && data.doctors.length > 0) {
        setSelectedDoctorId(data.doctors[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await apiRequest('/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/doctors', {
        method: 'POST',
        body: JSON.stringify({
          name: docName,
          email: docEmail,
          password: docPassword,
          specialization: docSpecialization,
          bio: docBio,
          workingHoursStart: docStartHours,
          workingHoursEnd: docEndHours,
          slotDurationMins: docSlotDuration
        })
      });

      setShowAddDoctorModal(false);
      setDocName('');
      setDocEmail('');
      fetchDoctors();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to create doctor');
    }
  };

  const handleAdminAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) return;

    setLeaveLoading(true);
    setLeaveResult(null);

    try {
      const res = await apiRequest(`/admin/doctors/${selectedDoctorId}/leave`, {
        method: 'POST',
        body: JSON.stringify({ leaveDate, reason: leaveReason })
      });

      setLeaveResult(res);
      fetchDoctors();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to set doctor leave');
    } finally {
      setLeaveLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Admin Title & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-purple-600" />
            Clinic Admin Portal
          </h2>
          <p className="text-xs text-slate-500">Manage doctor profiles, working hours, leave schedules, and system audit logs.</p>
        </div>

        <div className="flex space-x-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('DOCTORS')}
            className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'DOCTORS' ? 'bg-purple-600 text-white' : 'bg-white border text-slate-700 hover:bg-slate-50'}`}
          >
            Doctors Profiles ({doctors.length})
          </button>
          <button
            onClick={() => setActiveTab('LEAVES')}
            className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'LEAVES' ? 'bg-purple-600 text-white' : 'bg-white border text-slate-700 hover:bg-slate-50'}`}
          >
            Leave & Conflict Resolver
          </button>
          <button
            onClick={() => setActiveTab('STATS')}
            className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'STATS' ? 'bg-purple-600 text-white' : 'bg-white border text-slate-700 hover:bg-slate-50'}`}
          >
            System Overview & Audit
          </button>
        </div>
      </div>

      {/* TAB 1: DOCTORS MANAGEMENT */}
      {activeTab === 'DOCTORS' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">Doctor Profiles</h3>
            <button
              onClick={() => setShowAddDoctorModal(true)}
              className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New Doctor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {doctors.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{doc.user?.name}</h4>
                    <p className="text-xs text-purple-700 font-semibold">{doc.specialization}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{doc.user?.email}</p>
                  </div>
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <span className="font-semibold text-slate-700 block">Working Hours:</span>
                    <span>{doc.workingHoursStart} - {doc.workingHoursEnd}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                    <span className="font-semibold text-slate-700 block">Slot Duration:</span>
                    <span>{doc.slotDurationMins} Mins</span>
                  </div>
                </div>

                {doc.leaves && doc.leaves.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Scheduled Leave Days:</h5>
                    <div className="flex flex-wrap gap-1">
                      {doc.leaves.map((l: any) => (
                        <span key={l.id} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] rounded font-medium">
                          {l.leaveDate} {l.reason ? `(${l.reason})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: DOCTOR LEAVE MANAGEMENT & CONFLICT RESOLVER */}
      {activeTab === 'LEAVES' && (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-purple-600" />
              Doctor Leave & Conflict Resolver
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Setting a doctor leave date automatically checks for conflicting booked appointments, cancels them, updates DB status to CANCELLED_LEAVE, and dispatches automated cancellation emails to patients.
            </p>
          </div>

          <form onSubmit={handleAdminAddLeave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Doctor:</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-purple-500 focus:border-purple-500"
              >
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.user?.name} ({d.specialization})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Date:</label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave:</label>
              <input
                type="text"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Annual leave / Medical conference..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={leaveLoading}
              className="w-full py-3 bg-purple-600 text-white font-bold text-xs rounded-lg hover:bg-purple-700 transition-colors shadow disabled:opacity-50"
            >
              {leaveLoading ? 'Processing Conflicts & Dispatched Email Notifications...' : 'Process Leave & Resolve Appointment Conflicts'}
            </button>
          </form>

          {/* Leave Result Alert Card */}
          {leaveResult && (
            <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
                <span>Conflict Resolution Summary</span>
              </div>
              <p className="text-xs text-purple-800">{leaveResult.message}</p>

              {leaveResult.result?.affectedPatients?.length > 0 && (
                <div className="space-y-2 border-t border-purple-200 pt-3">
                  <h5 className="text-xs font-bold text-purple-900">Affected Patients Notified via Email:</h5>
                  <div className="space-y-1">
                    {leaveResult.result.affectedPatients.map((p: any, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded border border-purple-100 text-xs flex justify-between">
                        <span className="font-semibold text-slate-800">{p.patientName} ({p.patientEmail})</span>
                        <span className="text-slate-500">Slot: {p.startTime}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SYSTEM STATS & AUDIT */}
      {activeTab === 'STATS' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Patients</p>
                <h4 className="text-2xl font-bold text-slate-900">{stats.patientsCount}</h4>
              </div>
              <div className="p-3 bg-sky-100 text-sky-600 rounded-lg"><Users className="w-6 h-6" /></div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Active Doctors</p>
                <h4 className="text-2xl font-bold text-slate-900">{stats.doctorsCount}</h4>
              </div>
              <div className="p-3 bg-teal-100 text-teal-600 rounded-lg"><Stethoscope className="w-6 h-6" /></div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Appointments</p>
                <h4 className="text-2xl font-bold text-slate-900">{stats.totalAppointments}</h4>
              </div>
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg"><Calendar className="w-6 h-6" /></div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Leave Cancellations</p>
                <h4 className="text-2xl font-bold text-amber-600">{stats.cancelledLeaveCount}</h4>
              </div>
              <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><AlertTriangle className="w-6 h-6" /></div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center">
              <Bell className="w-4 h-4 mr-2 text-purple-600" />
              Recent Notification Audit Log
            </h4>
            <div className="space-y-2">
              {stats.recentLogs?.map((log: any) => (
                <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between text-xs gap-2">
                  <div>
                    <span className="font-bold text-slate-800">[{log.type}] {log.subject}</span>
                    <p className="text-slate-500">To: {log.recipient}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${log.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE DOCTOR MODAL */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Create New Doctor Profile</h3>
              <button onClick={() => setShowAddDoctorModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateDoctor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Doctor Name:</label>
                <input type="text" required value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Dr. Jane Smith" className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Email Address:</label>
                <input type="email" required value={docEmail} onChange={(e) => setDocEmail(e.target.value)} placeholder="doctor@clinic.com" className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Password:</label>
                <input type="password" required value={docPassword} onChange={(e) => setDocPassword(e.target.value)} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Specialization:</label>
                <input type="text" required value={docSpecialization} onChange={(e) => setDocSpecialization(e.target.value)} placeholder="Cardiology, Pediatrics..." className="w-full p-2 border rounded" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700">Start Hour:</label>
                  <input type="text" value={docStartHours} onChange={(e) => setDocStartHours(e.target.value)} placeholder="09:00" className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">End Hour:</label>
                  <input type="text" value={docEndHours} onChange={(e) => setDocEndHours(e.target.value)} placeholder="17:00" className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Slot (Mins):</label>
                  <input type="number" value={docSlotDuration} onChange={(e) => setDocSlotDuration(parseInt(e.target.value))} className="w-full p-2 border rounded" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Bio:</label>
                <textarea rows={2} value={docBio} onChange={(e) => setDocBio(e.target.value)} placeholder="Experienced specialist..." className="w-full p-2 border rounded" />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAddDoctorModal(false)} className="px-3 py-2 border rounded text-slate-600 font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white font-bold rounded hover:bg-purple-700">Create Doctor Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
