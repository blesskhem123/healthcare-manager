import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { addDoctorLeaveAndHandleConflicts } from '../services/leaveManagementService';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// List Doctors with profiles
router.get('/doctors', async (req: AuthRequest, res: Response) => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        leaves: true
      }
    });

    return res.json({ doctors });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch doctors' });
  }
});

// Create Doctor Profile & User Account
router.post('/doctors', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, phone, specialization, bio, workingHoursStart, workingHoursEnd, slotDurationMins } = req.body;

    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ error: 'Name, email, password, and specialization are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const doctorUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'DOCTOR',
        phone,
        doctorProfile: {
          create: {
            specialization,
            bio: bio || '',
            workingHoursStart: workingHoursStart || '09:00',
            workingHoursEnd: workingHoursEnd || '17:00',
            slotDurationMins: slotDurationMins ? parseInt(slotDurationMins) : 30
          }
        }
      },
      include: { doctorProfile: true }
    });

    return res.status(201).json({ message: 'Doctor profile created successfully', doctor: doctorUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create doctor' });
  }
});

// Update Doctor Profile
router.put('/doctors/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, specialization, bio, workingHoursStart, workingHoursEnd, slotDurationMins } = req.body;

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id } });
    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    if (name) {
      await prisma.user.update({
        where: { id: doctorProfile.userId },
        data: { name }
      });
    }

    const updatedProfile = await prisma.doctorProfile.update({
      where: { id },
      data: {
        specialization: specialization || doctorProfile.specialization,
        bio: bio !== undefined ? bio : doctorProfile.bio,
        workingHoursStart: workingHoursStart || doctorProfile.workingHoursStart,
        workingHoursEnd: workingHoursEnd || doctorProfile.workingHoursEnd,
        slotDurationMins: slotDurationMins ? parseInt(slotDurationMins) : doctorProfile.slotDurationMins
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    return res.json({ message: 'Doctor updated successfully', doctor: updatedProfile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update doctor' });
  }
});

// Mark Doctor on Leave (Triggers Conflict Management & Patient Email Notifications)
router.post('/doctors/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { leaveDate, reason } = req.body; // YYYY-MM-DD

    if (!leaveDate) {
      return res.status(400).json({ error: 'leaveDate is required (YYYY-MM-DD format)' });
    }

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id } });
    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const result = await addDoctorLeaveAndHandleConflicts(id, leaveDate, reason);

    return res.status(201).json({
      message: `Doctor leave set for ${leaveDate}. ${result.affectedCount} existing booking(s) were cancelled and patients notified.`,
      result
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to add doctor leave' });
  }
});

// Admin System Statistics Overview
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [patientsCount, doctorsCount, totalAppointments, cancelledLeaveCount, recentLogs] = await Promise.all([
      prisma.user.count({ where: { role: 'PATIENT' } }),
      prisma.doctorProfile.count(),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { status: 'CANCELLED_LEAVE' } }),
      prisma.notificationLog.findMany({ take: 5, orderBy: { createdAt: 'desc' } })
    ]);

    return res.json({
      patientsCount,
      doctorsCount,
      totalAppointments,
      cancelledLeaveCount,
      recentLogs
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch stats' });
  }
});

export default router;
