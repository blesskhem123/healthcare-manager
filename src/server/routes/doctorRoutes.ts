import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { generatePostVisitSummary } from '../services/geminiService';
import { addDoctorLeaveAndHandleConflicts } from '../services/leaveManagementService';
import { sendEmailNotification } from '../services/emailService';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['DOCTOR']));

// Fetch Doctor Appointments with Patient Info and AI Pre-visit Summaries
router.get('/appointments', async (req: AuthRequest, res: Response) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const appointments = await prisma.appointment.findMany({
      where: { doctorId: doctorProfile.id },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        preVisitSummary: true,
        postVisitSummary: true
      },
      orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }]
    });

    return res.json({ appointments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch doctor appointments' });
  }
});

// Submit Post-Visit Notes and Generate Patient-Friendly AI Summary
router.post('/appointments/:id/post-visit', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { doctorNotes, followUpDays } = req.body;

    if (!doctorNotes) {
      return res.status(400).json({ error: 'doctorNotes are required' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: true, doctor: { include: { user: true } } }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Call LLM for Post-Visit Summary
    const aiResult = await generatePostVisitSummary(doctorNotes);

    // Save Post-Visit Summary
    const postVisitSummary = await prisma.postVisitSummary.upsert({
      where: { appointmentId: id },
      update: {
        doctorNotes,
        patientSummary: aiResult.patientSummary,
        medicationSchedule: JSON.stringify(aiResult.medicationSchedule),
        followUpSteps: aiResult.followUpSteps
      },
      create: {
        appointmentId: id,
        doctorNotes,
        patientSummary: aiResult.patientSummary,
        medicationSchedule: JSON.stringify(aiResult.medicationSchedule),
        followUpSteps: aiResult.followUpSteps
      }
    });

    // Mark appointment completed
    await prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' }
    });

    // Create Medication Reminders in DB for background job tracking
    const today = new Date();
    const startDateStr = today.toISOString().split('T')[0];
    const durationDays = followUpDays ? parseInt(followUpDays) : 7;
    const endDate = new Date(today.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const endDateStr = endDate.toISOString().split('T')[0];

    if (Array.isArray(aiResult.medicationSchedule)) {
      for (const med of aiResult.medicationSchedule) {
        await prisma.medicationReminder.create({
          data: {
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            medicationName: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            startDate: startDateStr,
            endDate: endDateStr,
            status: 'ACTIVE'
          }
        });
      }
    }

    // Email post-visit summary to patient
    const emailSubject = `Post-Visit Summary & Prescription from Dr. ${appointment.doctor.user.name}`;
    const emailContent = `Dear ${appointment.patient.name},

Thank you for visiting Dr. ${appointment.doctor.user.name} today. Here is your post-visit summary and prescription guidelines:

Patient Summary:
${aiResult.patientSummary}

Medication Schedule:
${aiResult.medicationSchedule.map(m => `- ${m.name} (${m.dosage}): ${m.frequency}`).join('\n')}

Follow-Up Steps:
${aiResult.followUpSteps}

Take care,
Healthcare Clinic Team`;

    await sendEmailNotification({
      recipient: appointment.patient.email,
      subject: emailSubject,
      content: emailContent
    });

    return res.status(200).json({
      message: 'Post-visit notes and AI summary saved successfully',
      postVisitSummary,
      medicationSchedule: aiResult.medicationSchedule
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit post-visit notes' });
  }
});

// Doctor self-add leave
router.post('/leave', async (req: AuthRequest, res: Response) => {
  try {
    const { leaveDate, reason } = req.body;

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const result = await addDoctorLeaveAndHandleConflicts(doctorProfile.id, leaveDate, reason);

    return res.status(201).json({
      message: `Leave added for ${leaveDate}. ${result.affectedCount} appointments were cancelled and patients notified.`,
      result
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to set doctor leave' });
  }
});

export default router;
