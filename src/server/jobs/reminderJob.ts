import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { sendEmailNotification, processFailedNotificationRetries } from '../services/emailService';

export function startBackgroundJobs() {
  console.log('⚡ Initializing Healthcare Background Cron Workers (Medication Reminders & Email Retries)...');

  // Job 1: Medication Reminders (Runs every 15 minutes or top of hour)
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON JOB] Scanning for pending medication reminders...');
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const activeReminders = await prisma.medicationReminder.findMany({
        where: {
          status: 'ACTIVE',
          startDate: { lte: todayStr },
          endDate: { gte: todayStr }
        }
      });

      for (const reminder of activeReminders) {
        // Fetch patient details
        const patient = await prisma.user.findUnique({
          where: { id: reminder.patientId }
        });

        if (patient) {
          const subject = `[REMINDER] Time for your medication: ${reminder.medicationName}`;
          const content = `Hello ${patient.name},

This is a scheduled medication reminder from your healthcare provider.

Medication: ${reminder.medicationName}
Dosage: ${reminder.dosage}
Frequency: ${reminder.frequency}

Please take your medication as prescribed by your doctor. If you have any unusual side effects, contact your clinic immediately.

Stay Healthy!`;

          await sendEmailNotification({
            recipient: patient.email,
            subject,
            content
          });

          await prisma.medicationReminder.update({
            where: { id: reminder.id },
            data: { lastSentAt: new Date() }
          });
        }
      }
    } catch (err) {
      console.error('Error running medication reminder cron job:', err);
    }
  });

  // Job 2: Process Failed Notification Retries (Runs every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processFailedNotificationRetries();
    } catch (err) {
      console.error('Error in notification retry cron job:', err);
    }
  });
}
