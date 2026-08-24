import { prisma } from '../config/prisma';

export const HOLD_DURATION_MINUTES = 5;

/**
 * Hold a slot temporarily for 5 minutes for a patient
 */
export async function holdSlot(doctorId: string, appointmentDate: string, startTime: string, patientId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_DURATION_MINUTES * 60 * 1000);

  // Clean expired holds first
  await prisma.slotHold.deleteMany({
    where: {
      expiresAt: { lt: now }
    }
  });

  // Check if slot is already booked
  const existingBooking = await prisma.appointment.findFirst({
    where: {
      doctorId,
      appointmentDate,
      startTime,
      status: 'BOOKED'
    }
  });

  if (existingBooking) {
    throw new Error('Slot is already booked by another patient.');
  }

  // Check if slot is on doctor leave
  const doctorLeave = await prisma.doctorLeave.findFirst({
    where: {
      doctorId,
      leaveDate: appointmentDate
    }
  });

  if (doctorLeave) {
    throw new Error('Doctor is on leave on this date.');
  }

  // Check if held by another patient
  const activeHold = await prisma.slotHold.findFirst({
    where: {
      doctorId,
      appointmentDate,
      startTime,
      expiresAt: { gt: now }
    }
  });

  if (activeHold && activeHold.patientId !== patientId) {
    throw new Error('Slot is currently held by another user. Please try again shortly or pick another time.');
  }

  // Upsert hold for this patient
  const hold = await prisma.slotHold.upsert({
    where: {
      doctorId_appointmentDate_startTime: {
        doctorId,
        appointmentDate,
        startTime
      }
    },
    update: {
      patientId,
      expiresAt,
      createdAt: now
    },
    create: {
      doctorId,
      appointmentDate,
      startTime,
      patientId,
      expiresAt
    }
  });

  return {
    holdId: hold.id,
    expiresAt: hold.expiresAt,
    holdDurationSeconds: HOLD_DURATION_MINUTES * 60
  };
}

/**
 * Safely complete booking within an isolated transaction
 */
export async function confirmBookingTransaction(params: {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  symptoms: string;
}) {
  const { patientId, doctorId, appointmentDate, startTime, endTime, symptoms } = params;
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Double check leave
    const leave = await tx.doctorLeave.findFirst({
      where: { doctorId, leaveDate: appointmentDate }
    });
    if (leave) {
      throw new Error('Doctor is on leave on this date.');
    }

    // 2. Double check existing active booking
    const existing = await tx.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate,
        startTime,
        status: 'BOOKED'
      }
    });
    if (existing) {
      throw new Error('Slot double-booking prevented: Slot has already been confirmed by another patient.');
    }

    // 3. Verify hold condition (if held by someone else)
    const hold = await tx.slotHold.findFirst({
      where: {
        doctorId,
        appointmentDate,
        startTime,
        expiresAt: { gt: now }
      }
    });

    if (hold && hold.patientId !== patientId) {
      throw new Error('Slot is currently reserved by another patient.');
    }

    // 4. Create appointment
    const appointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        symptoms,
        status: 'BOOKED'
      },
      include: {
        patient: true,
        doctor: {
          include: {
            user: true
          }
        }
      }
    });

    // 5. Remove hold after booking
    await tx.slotHold.deleteMany({
      where: {
        doctorId,
        appointmentDate,
        startTime
      }
    });

    return appointment;
  });
}
