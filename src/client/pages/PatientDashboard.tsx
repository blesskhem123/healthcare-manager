import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { UrgencyBadge } from '../components/UrgencyBadge';
import { Search, Calendar, Clock, Stethoscope, AlertTriangle, CheckCircle2, Pill, ShieldAlert, Sparkles, FileText, ChevronRight } from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BOOK' | 'MY_APPOINTMENTS'>('BOOK');

  // Search & Slot selection state
  const [specialization, setSpecialization] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slotsData, setSlotsData] = useState<any | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Hold lock state
  const [holdInfo, setHoldInfo] = useState<{ holdId: string; expiresAt: string; holdTimerSeconds: number } | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);

  // Symptom & Booking state
  const [symptoms, setSymptoms] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  // Patient Appointments & Reminders state
  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  // Load doctors on mount
  useEffect(() => {
    fetchDoctors();
  }, [specialization]);

  // Load patient appointments when tab switches
  useEffect(() => {
    if (activeTab === 'MY_APPOINTMENTS') {
      fetchMyAppointments();
    }
  }, [activeTab]);

  // Hold timer countdown interval
  useEffect(() => {
    if (!holdInfo) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(holdInfo.expiresAt).getTime() - new Date().getTime()) / 1000));
      if (remaining === 0) {
        setHoldInfo(null);
        setSelectedSlot(null);
        setHoldError('Slot hold expired. Please select a time slot again.');
      } else {
        setHoldInfo(prev => prev ? { ...prev, holdTimerSeconds: remaining } : null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [holdInfo]);

  const fetchDoctors = async () => {
    try {
      const data = await apiRequest(`/patient/doctors${specialization ? `?specialization=${encodeURIComponent(specialization)}` : ''}`);
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error('Failed to load doctors', err);
    }
  };

  const fetchSlots = async (docId: string, date: string) => {
    setSlotsData(null);
    setSelectedSlot(null);
    setHoldInfo(null);
    setHoldError(null);
    try {
      const data = await apiRequest(`/patient/doctors/${docId}/slots?date=${date}`);
      setSlotsData(data);
    } catch (err: any) {
      console.error('Failed to load slots', err);
    }
  };

  const handleSelectDoctor = (doc: any) => {
    setSelectedDoctor(doc);
    fetchSlots(doc.id, selectedDate);
  };

  const handleHoldSlot = async (slotTime: string) => {
    if (!selectedDoctor) return;
    setHoldError(null);
    try {
      const res = await apiRequest('/patient/hold-slot', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          appointmentDate: selectedDate,
          startTime: slotTime
        })
      });
      setSelectedSlot(slotTime);
      setHoldInfo({
        holdId: res.holdId,
        expiresAt: res.expiresAt,
        holdTimerSeconds: res.holdDurationSeconds || 300
      });
    } catch (err: any) {
      setHoldError(err.message || 'Failed to hold slot');
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedSlot || !symptoms) return;

    setBookingLoading(true);
    setHoldError(null);

    try {
      const res = await apiRequest('/patient/book', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          appointmentDate: selectedDate,
          startTime: selectedSlot,
          symptoms
        })
      });

      setBookingSuccess(res);
      setHoldInfo(null);
      setSelectedSlot(null);
      setSymptoms('');
      fetchMyAppointments();
    } catch (err: any) {
      setHoldError(err.message || 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  const fetchMyAppointments = async () => {
    setLoadingAppts(true);
    try {
      const data = await apiRequest('/patient/appointments');
      setMyAppointments(data.appointments || []);
      setReminders(data.reminders || []);
    } catch (err) {
      console.error('Failed to fetch patient appointments', err);
    } finally {
      setLoadingAppts(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex space-x-8">
        <button
          onClick={() => { setActiveTab('BOOK'); setBookingSuccess(null); }}
          className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center space-x-2 transition-colors ${activeTab === 'BOOK' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Calendar className="w-4 h-4" />
          <span>Book New Appointment</span>
        </button>

        <button
          onClick={() => setActiveTab('MY_APPOINTMENTS')}
          className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center space-x-2 transition-colors ${activeTab === 'MY_APPOINTMENTS' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Clock className="w-4 h-4" />
          <span>My Appointments & Medications</span>
        </button>
      </div>

      {/* TAB 1: BOOK APPOINTMENT */}
      {activeTab === 'BOOK' && (
        <div className="space-y-6">
          {bookingSuccess ? (
            <div className="bg-white rounded-xl shadow-md border border-emerald-200 p-8 text-center space-y-4 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Appointment Confirmed!</h2>
              <p className="text-slate-600 text-sm">
                Your appointment with <span className="font-semibold text-slate-900">Dr. {bookingSuccess.appointment?.doctor?.user?.name}</span> has been confirmed for <span className="font-semibold text-slate-900">{bookingSuccess.appointment?.appointmentDate} at {bookingSuccess.appointment?.startTime}</span>.
              </p>

              {/* AI Pre-visit summary card preview */}
              {bookingSuccess.preVisitSummary && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center">
                      <Sparkles className="w-4 h-4 mr-1 text-sky-600" />
                      AI Pre-Visit Symptom Summary for Doctor
                    </span>
                    <UrgencyBadge urgency={bookingSuccess.preVisitSummary.urgency} />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-slate-500">Chief Complaint</h4>
                    <p className="text-sm font-semibold text-slate-800">{bookingSuccess.preVisitSummary.chiefComplaint}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-1">Suggested Consultation Questions</h4>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                      {bookingSuccess.preVisitSummary.suggestedQuestions?.map((q: string, idx: number) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500">
                A confirmation email and Google Calendar event have been dispatched to your email address.
              </p>

              <button
                onClick={() => { setBookingSuccess(null); setActiveTab('MY_APPOINTMENTS'); }}
                className="px-6 py-2.5 bg-sky-600 text-white font-medium text-sm rounded-lg hover:bg-sky-700 transition-colors"
              >
                View My Appointments
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Doctor Search & List Column */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">1. Select Doctor</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search specialization..."
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {doctors.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoctor(doc)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedDoctor?.id === doc.id ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200' : 'bg-white border-slate-200 hover:border-sky-300'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{doc.user?.name}</h4>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-sky-100 text-sky-800 text-xs font-semibold rounded">
                            {doc.specialization}
                          </span>
                        </div>
                        <Stethoscope className="w-5 h-5 text-sky-600" />
                      </div>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{doc.bio}</p>
                      <div className="mt-3 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                        <span>Hours: {doc.workingHoursStart} - {doc.workingHoursEnd}</span>
                        <span>Slot: {doc.slotDurationMins}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slot Picker & Booking Form Column */}
              <div className="lg:col-span-2 space-y-6">
                {selectedDoctor ? (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">2. Choose Date & Available Slot</h3>
                      <p className="text-xs text-slate-500">Selected: Dr. {selectedDoctor.user?.name} ({selectedDoctor.specialization})</p>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center space-x-3">
                      <label className="text-xs font-semibold text-slate-700">Date:</label>
                      <input
                        type="date"
                        value={selectedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          fetchSlots(selectedDoctor.id, e.target.value);
                        }}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>

                    {/* Active Hold Lock Banner */}
                    {holdInfo && (
                      <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-amber-900 text-xs font-semibold">
                          <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                          <span>Slot {selectedSlot} is locked for you! Completing checkout...</span>
                        </div>
                        <span className="px-2 py-1 bg-amber-200 text-amber-900 rounded font-mono text-xs font-bold">
                          {formatTimer(holdInfo.holdTimerSeconds)}
                        </span>
                      </div>
                    )}

                    {holdError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs font-medium flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2 text-rose-500" />
                        {holdError}
                      </div>
                    )}

                    {/* Slots Grid */}
                    {slotsData?.isDoctorOnLeave ? (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-center space-y-1">
                        <ShieldAlert className="w-6 h-6 mx-auto text-rose-500" />
                        <h4 className="font-bold text-sm">Doctor on Leave</h4>
                        <p className="text-xs">Dr. {selectedDoctor.user?.name} is on leave on {selectedDate}. Please select another date.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-700">Available Time Slots</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {slotsData?.slots?.map((slot: any) => {
                            const isSelected = selectedSlot === slot.startTime;
                            return (
                              <button
                                key={slot.startTime}
                                disabled={!slot.isAvailable && !isSelected}
                                onClick={() => handleHoldSlot(slot.startTime)}
                                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                                  isSelected
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-300'
                                    : slot.isAvailable
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                                }`}
                              >
                                {slot.startTime}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 3. Symptom Form */}
                    {selectedSlot && (
                      <form onSubmit={handleConfirmBooking} className="border-t border-slate-200 pt-6 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center">
                            <Sparkles className="w-4 h-4 mr-1.5 text-sky-600" />
                            3. Patient Pre-Visit Symptom Form
                          </h3>
                          <p className="text-xs text-slate-500">
                            Describe your symptoms in detail. Our AI will generate a pre-visit clinical summary and urgency assessment for the doctor.
                          </p>
                        </div>

                        <div>
                          <textarea
                            required
                            rows={4}
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            placeholder="Describe your symptoms (e.g. onset, severity, location, duration, fever, pain level...)"
                            className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-sky-500 focus:border-sky-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={bookingLoading}
                          className="w-full py-3 px-4 bg-sky-600 text-white text-sm font-bold rounded-lg shadow hover:bg-sky-700 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
                        >
                          {bookingLoading ? (
                            <span>Generating AI Summary & Booking...</span>
                          ) : (
                            <>
                              <span>Confirm & Book Appointment</span>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500 space-y-2">
                    <Stethoscope className="w-10 h-10 mx-auto text-slate-300" />
                    <h3 className="text-base font-semibold text-slate-700">No Doctor Selected</h3>
                    <p className="text-xs">Please choose a doctor from the list on the left to view available time slots.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY APPOINTMENTS & MEDICATION REMINDERS */}
      {activeTab === 'MY_APPOINTMENTS' && (
        <div className="space-y-8">
          
          {/* Active Medication Reminders Section */}
          {reminders.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-emerald-900 flex items-center">
                <Pill className="w-4 h-4 mr-2 text-emerald-600" />
                Active Medication Schedule Reminders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {reminders.map((rem) => (
                  <div key={rem.id} className="bg-white p-3.5 rounded-lg border border-emerald-200 shadow-sm space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{rem.medicationName}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">{rem.dosage}</span>
                    </div>
                    <p className="text-slate-600">Frequency: <span className="font-medium">{rem.frequency}</span></p>
                    <p className="text-slate-400 text-[11px]">Duration: {rem.startDate} to {rem.endDate}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Appointments List */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Your Appointment History</h3>
            
            {loadingAppts ? (
              <p className="text-xs text-slate-500">Loading appointments...</p>
            ) : myAppointments.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                No appointments found. Click "Book New Appointment" to schedule one.
              </div>
            ) : (
              <div className="space-y-4">
                {myAppointments.map((apt) => (
                  <div key={apt.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Dr. {apt.doctor?.user?.name}</h4>
                        <p className="text-xs text-sky-600 font-semibold">{apt.doctor?.specialization}</p>
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

                    {/* Pre-Visit AI Summary */}
                    {apt.preVisitSummary && (
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 flex items-center">
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-sky-600" />
                            AI Pre-Visit Assessment
                          </span>
                          <UrgencyBadge urgency={apt.preVisitSummary.urgency} />
                        </div>
                        <p className="text-slate-600"><span className="font-medium text-slate-800">Chief Complaint:</span> {apt.preVisitSummary.chiefComplaint}</p>
                      </div>
                    )}

                    {/* Post-Visit Doctor Summary & Prescription */}
                    {apt.postVisitSummary && (
                      <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl space-y-3 text-xs">
                        <div className="flex items-center space-x-1.5 text-sky-900 font-bold text-sm">
                          <FileText className="w-4 h-4 text-sky-600" />
                          <span>Post-Visit Summary & Prescription Notes</span>
                        </div>
                        
                        <div>
                          <h5 className="font-semibold text-slate-700">Patient-Friendly Summary:</h5>
                          <p className="text-slate-700 mt-0.5">{apt.postVisitSummary.patientSummary}</p>
                        </div>

                        {apt.postVisitSummary.medicationSchedule && (
                          <div>
                            <h5 className="font-semibold text-slate-700 mb-1">Prescribed Medication Schedule:</h5>
                            <div className="bg-white p-2.5 rounded border border-sky-100 space-y-1">
                              {JSON.parse(apt.postVisitSummary.medicationSchedule).map((med: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-slate-800">
                                  <span className="font-bold">• {med.name} ({med.dosage})</span>
                                  <span className="text-slate-500">{med.frequency}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h5 className="font-semibold text-slate-700">Follow-Up Steps:</h5>
                          <p className="text-slate-700 mt-0.5">{apt.postVisitSummary.followUpSteps}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
