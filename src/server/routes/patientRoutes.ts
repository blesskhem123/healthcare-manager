import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { holdSlot, confirmBookingTransaction } from '../services/slotLockService';
import { generatePreVisitSummary } from '../services/geminiService';
import { sendEmailNotification } from '../services/emailService';
import { createCalendarEvent } from '../services/calendarService';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['PATIENT']));

// Search & List Doctors by Specialization
router.get('/doctors', async (req: AuthRequest, res: Response) => {
  try {
    const specialization = typeof req.query.specialization === 'string'
      ? req.query.specialization
      : Array.isArray(req.query.specialization)
      ? String(req.query.specialization[0])
      : undefined;

    const where: any = {};
    if (specialization && specialization.trim() !== '') {
      where.specialization = { contains: specialization };
    }

    const doctors = await prisma.doctorProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        leaves: true
      }
    });

    return res.json({ doctors });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to search doctors' });
  }
});

// Helper function to generate time slots (e.g. 09:00, 09:30, 10:00...)
function generateTimeSlots(startStr: string, endStr: string, durationMins: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  let currentMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  while (currentMins + durationMins <= endMins) {
    const h = Math.floor(currentMins / 60).toString().padStart(2, '0');
    const m = (currentMins % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMins += durationMins;
  }

  return slots;
}

// Get Available Slots for a Doctor on a Specific Date
router.get('/doctors/:id/slots', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const date = typeof req.query.date === 'string'
      ? req.query.date
      : Array.isArray(req.query.date)
      ? String(req.query.date[0])
      : undefined;

    if (!date) {
      return res.status(400).json({ error: 'Date query param (YYYY-MM-DD) is required' });
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id }
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check if Doctor is on Leave
    const isLeave = await prisma.doctorLeave.findFirst({
      where: { doctorId: id, leaveDate: date }
    });

    if (isLeave) {
      return res.json({
        date,
        isDoctorOnLeave: true,
        availableSlots: [],
        message: 'Doctor is on leave on this date.'
      });
    }

    // Generate all base slots for the working day
    const allSlots = generateTimeSlots(
      doctorProfile.workingHoursStart,
      doctorProfile.workingHoursEnd,
      doctorProfile.slotDurationMins
    );

    // Fetch existing confirmed bookings
    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: id,
        appointmentDate: date,
        status: 'BOOKED'
      },
      select: { startTime: true }
    });
    const bookedTimes = new Set(bookedAppointments.map(a => a.startTime));

    // Fetch active slot holds by other users
    const now = new Date();
    const activeHolds = await prisma.slotHold.findMany({
      where: {
        doctorId: id,
        appointmentDate: date,
        expiresAt: { gt: now }
      }
    });
    const heldTimes = new Set(activeHolds.map(h => h.startTime));

    const slotStatusList = allSlots.map(time => {
      const isBooked = bookedTimes.has(time);
      const isHeld = heldTimes.has(time);
      return {
        startTime: time,
        isAvailable: !isBooked && !isHeld,
        isBooked,
        isHeld
      };
    });

    return res.json({
      date,
      isDoctorOnLeave: false,
      slotDurationMins: doctorProfile.slotDurationMins,
      slots: slotStatusList
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch doctor slots' });
  }
});

// Temporary Slot Hold Lock (5 minutes hold)
router.post('/hold-slot', async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId, appointmentDate, startTime } = req.body;

    if (!doctorId || !appointmentDate || !startTime) {
      return res.status(400).json({ error: 'doctorId, appointmentDate, and startTime are required' });
    }

    const holdResult = await holdSlot(doctorId, appointmentDate, startTime, req.user!.id);

    return res.status(200).json({
      message: 'Slot successfully reserved for 5 minutes',
      ...holdResult
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to hold slot' });
  }
});

// Book Appointment with Symptoms & AI Pre-visit Summary
router.post('/book', async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId, appointmentDate, startTime, symptoms } = req.body;

    if (!doctorId || !appointmentDate || !startTime || !symptoms) {
      return res.status(400).json({ error: 'doctorId, appointmentDate, startTime, and symptoms are required' });
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: true }
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Calculate End Time
    const [h, m] = startTime.split(':').map(Number);
    const endMins = h * 60 + m + doctorProfile.slotDurationMins;
    const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;

    // 1. Confirm Atomic Booking in DB Transaction
    const appointment = await confirmBookingTransaction({
      patientId: req.user!.id,
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      symptoms
    });

    // 2. Generate LLM Pre-Visit Summary for Doctor
    const aiResult = await generatePreVisitSummary(symptoms);

    // Save Pre-Visit Summary
    const preVisitSummary = await prisma.preVisitSummary.create({
      data: {
        appointmentId: appointment.id,
        urgency: aiResult.urgency,
        chiefComplaint: aiResult.chiefComplaint,
        suggestedQuestions: JSON.stringify(aiResult.suggestedQuestions),
        rawLlmOutput: aiResult.rawLlmOutput
      }
    });

    // 3. Create Google Calendar Event
    const startIso = `${appointmentDate}T${startTime}:00Z`;
    const endIso = `${appointmentDate}T${endTime}:00Z`;
    const calendarEventId = await createCalendarEvent({
      summary: `Medical Appointment: ${appointment.patient.name} & Dr. ${doctorProfile.user.name}`,
      description: `Chief Complaint: ${aiResult.chiefComplaint}\nUrgency: ${aiResult.urgency}\nSymptoms: ${symptoms}`,
      startDateTime: startIso,
      endDateTime: endIso,
      patientEmail: appointment.patient.email,
      doctorEmail: doctorProfile.user.email
    });

    if (calendarEventId) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleEventId: calendarEventId }
      });
    }

    // 4. Send Confirmation Emails
    const confirmationText = `Dear ${appointment.patient.name},

Your appointment has been successfully booked!

Doctor: Dr. ${doctorProfile.user.name} (${doctorProfile.specialization})
Date: ${appointmentDate}
Time: ${startTime} - ${endTime}

Symptoms Summary: ${aiResult.chiefComplaint} (Urgency: ${aiResult.urgency})

Thank you for choosing Healthcare Clinic!`;

    await sendEmailNotification({
      recipient: appointment.patient.email,
      subject: `Appointment Confirmation: Dr. ${doctorProfile.user.name} on ${appointmentDate}`,
      content: confirmationText
    });

    return res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
      preVisitSummary: {
        ...preVisitSummary,
        suggestedQuestions: aiResult.suggestedQuestions
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Booking failed' });
  }
});

// View Patient's Appointments
router.get('/appointments', async (req: AuthRequest, res: Response) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { patientId: req.user!.id },
      include: {
        doctor: {
          include: { user: { select: { name: true, email: true, phone: true } } }
        },
        preVisitSummary: true,
        postVisitSummary: true
      },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }]
    });

    // Also fetch active medication reminders
    const reminders = await prisma.medicationReminder.findMany({
      where: { patientId: req.user!.id, status: 'ACTIVE' }
    });

    return res.json({ appointments, reminders });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch patient appointments' });
  }
});

export default router;
