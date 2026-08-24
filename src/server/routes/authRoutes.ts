import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_healthcare_jwt_key_2026';

// Register User
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role, phone, specialization, bio, workingHoursStart, workingHoursEnd, slotDurationMins } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }

    if (!['PATIENT', 'DOCTOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Role must be PATIENT, DOCTOR, or ADMIN' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        phone
      }
    });

    let doctorProfile = null;
    if (role === 'DOCTOR') {
      doctorProfile = await prisma.doctorProfile.create({
        data: {
          userId: user.id,
          specialization: specialization || 'General Medicine',
          bio: bio || 'Experienced medical practitioner.',
          workingHoursStart: workingHoursStart || '09:00',
          workingHoursEnd: workingHoursEnd || '17:00',
          slotDurationMins: slotDurationMins ? parseInt(slotDurationMins) : 30
        }
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        doctorProfileId: doctorProfile?.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        doctorProfileId: doctorProfile?.id
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Login User
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        doctorProfileId: user.doctorProfile?.id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        doctorProfileId: user.doctorProfile?.id
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { doctorProfile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        doctorProfile: user.doctorProfile
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
});

export default router;
