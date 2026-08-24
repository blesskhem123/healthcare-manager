import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { UrgencyBadge } from '../components/UrgencyBadge';
import { Calendar, Clock, User, Sparkles, FileText, CheckCircle2, AlertTriangle, Pill, Send, PlusCircle } from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected appointment for completing consultation
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDays, setFollowUpDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);

  // Leave Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveResult, setLeaveResult] = useState<any | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/doctor/appointments');
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error('Failed to fetch doctor appointments', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt || !doctorNotes) return;

    setSubmitting(true);
    setSubmitSuccess(null);

    try {
      const res = await apiRequest(`/doctor/appointments/${selectedAppt.id}/post-visit`, {
        method: 'POST',
        body: JSON.stringify({
          doctorNotes,
          followUpDays
        })
      });

      setSubmitSuccess(res);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to submit post-visit summary');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/doctor/leave', {
        method: 'POST',
        body: JSON.stringify({ leaveDate, reason: leaveReason })
      });
      setLeaveResult(res);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to add leave');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Doctor Portal & Consultations</h2>
          <p className="text-xs text-slate-500">Review AI Pre-Visit summaries and submit post-consultation prescriptions.</p>
        </div>

        <button
          onClick={() => { setShowLeaveModal(true); setLeaveResult(null); }}
          className="px-4 py-2 bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-xs rounded-lg hover:bg-amber-100 transition-colors flex items-center space-x-1.5"
        >
          <PlusCircle className="w-4 h-4 text-amber-600" />
          <span>Mark Leave Date</span>
        </button>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900">Patient Appointments & AI Pre-Visit Summaries</h3>

        {loading ? (
          <p className="text-xs text-slate-500">Loading schedule...</p>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
            No appointments scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {appointments.map((apt) => {
              const questions = apt.preVisitSummary?.suggestedQuestions
                ? JSON.parse(apt.preVisitSummary.suggestedQuestions)
                : [];

              return (
                <div key={apt.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                        {apt.patient?.name?.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{apt.patient?.name}</h4>
                        <p className="text-xs text-slate-500">Email: {apt.patient?.email} | Phone: {apt.patient?.phone || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <span className="font-medium text-slate-600 flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {apt.appointmentDate} ({apt.startTime} - {apt.endTime})
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        apt.status === 'BOOKED' ? 'bg-sky-100 text-sky-800' :
                        apt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>

                  {/* AI Pre-Visit Summary Card */}
                  {apt.preVisitSummary && (
                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-900 flex items-center">
                          <Sparkles className="w-4 h-4 mr-1.5 text-sky-600" />
                          AI Pre-Visit Symptom Analysis (For Doctor Review)
                        </span>
                        <UrgencyBadge urgency={apt.preVisitSummary.urgency} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <h5 className="font-bold text-slate-700">Chief Complaint:</h5>
                          <p className="text-slate-800 mt-0.5">{apt.preVisitSummary.chiefComplaint}</p>
                          <p className="text-slate-500 text-[11px] mt-1">Raw Symptoms: "{apt.symptoms}"</p>
                        </div>

                        <div>
                          <h5 className="font-bold text-slate-700 mb-1">Suggested Questions for Consultation:</h5>
                          <ul className="list-disc list-inside text-slate-700 space-y-1">
                            {questions.map((q: string, idx: number) => (
                              <li key={idx}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Post Visit Status or Complete Action */}
                  <div className="flex justify-end pt-2">
                    {apt.status === 'COMPLETED' ? (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                        Post-Visit Summary & Prescription Submitted
                      </span>
                    ) : apt.status === 'BOOKED' ? (
                      <button
                        onClick={() => {
                          setSelectedAppt(apt);
                          setDoctorNotes('');
                          setSubmitSuccess(null);
                        }}
                        className="px-4 py-2 bg-sky-600 text-white font-semibold text-xs rounded-lg hover:bg-sky-700 transition-colors flex items-center space-x-1.5"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Complete Visit & Add Notes</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPLETE APPOINTMENT MODAL */}
      {selectedAppt && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Post-Visit Notes & Prescription</h3>
                <p className="text-xs text-slate-500">Patient: {selectedAppt.patient?.name} ({selectedAppt.appointmentDate})</p>
              </div>
              <button onClick={() => setSelectedAppt(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
            </div>

            {submitSuccess ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Summary & Prescription Saved!</h4>
                <p className="text-xs text-slate-600">The LLM converted your clinical notes into a patient-friendly summary and dispatched the email notification.</p>
                <button
                  onClick={() => setSelectedAppt(null)}
                  className="px-5 py-2 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCompleteAppointment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Doctor Clinical Notes & Prescribed Medications:
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="e.g. Patient diagnosed with mild upper respiratory infection. Prescribed Amoxicillin 500mg twice daily after meals for 5 days. Advised warm fluids and rest. Follow up if fever exceeds 101F."
                    className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-sky-500 focus:border-sky-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    AI will convert these notes into patient-friendly language and extract medication schedule & dosage.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Days Duration:</label>
                  <input
                    type="number"
                    value={followUpDays}
                    min={1}
                    max={30}
                    onChange={(e) => setFollowUpDays(parseInt(e.target.value))}
                    className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAppt(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Generating AI Summary...' : 'Submit & Convert AI Summary'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DOCTOR LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Set Doctor Leave Date</h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {leaveResult ? (
              <div className="space-y-3 bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs">
                <p className="font-bold text-amber-900">{leaveResult.message}</p>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="w-full py-2 bg-amber-600 text-white font-bold rounded-lg"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddLeave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Leave Date:</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Reason (Optional):</label>
                  <input
                    type="text"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Attending medical conference..."
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                  ⚠️ Any existing patient bookings on this date will be automatically cancelled and affected patients will receive notification emails.
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="px-3 py-2 border text-slate-600 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700"
                  >
                    Confirm Leave
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
