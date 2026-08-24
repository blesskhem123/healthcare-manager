import { prisma } from '../config/prisma';
import { sendEmailNotification } from './emailService';
import { deleteCalendarEvent } from './calendarService';

export async function addDoctorLeaveAndHandleConflicts(doctorId: string, leaveDate: string, reason?: string) {
  // 1. Create leave entry
  const leave = await prisma.doctorLeave.create({
    data: {
      doctorId,
      leaveDate,
      reason
    }
  });

  // 2. Find affected appointments
  const affectedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: leaveDate,
      status: 'BOOKED'
    },
    include: {
      patient: true,
      doctor: {
        include: { user: true }
      }
    }
  });

  // 3. Mark affected appointments as CANCELLED_LEAVE
  if (affectedAppointments.length > 0) {
    await prisma.appointment.updateMany({
      where: {
        id: { in: affectedAppointments.map(a => a.id) }
      },
      data: {
        status: 'CANCELLED_LEAVE'
      }
    });
  }

  // 4. Send cancellation notifications & clear calendar events
  const notificationPromises = affectedAppointments.map(async (apt) => {
    // Delete Google Calendar Event if exists
    if (apt.googleEventId) {
      try {
        await deleteCalendarEvent(apt.googleEventId);
      } catch (err) {
        console.warn(`Failed to delete Google Calendar event ${apt.googleEventId}:`, err);
      }
    }

    // Notify patient
    const patientSubject = `[CANCELLED] Appointment with Dr. ${apt.doctor.user.name} on ${apt.appointmentDate}`;
    const patientContent = `Dear ${apt.patient.name},

We regret to inform you that your appointment scheduled for ${apt.appointmentDate} at ${apt.startTime} with Dr. ${apt.doctor.user.name} (${apt.doctor.specialization}) has been cancelled due to doctor leave ${reason ? `(${reason})` : ''}.

Please log into the patient portal to reschedule your appointment for an alternative slot.

Best regards,
Healthcare Clinic Management`;

    await sendEmailNotification({
      recipient: apt.patient.email,
      subject: patientSubject,
      content: patientContent
    });
  });

  await Promise.all(notificationPromises);

  return {
    leave,
    affectedCount: affectedAppointments.length,
    affectedPatients: affectedAppointments.map(a => ({
      appointmentId: a.id,
      patientName: a.patient.name,
      patientEmail: a.patient.email,
      startTime: a.startTime
    }))
  };
}
