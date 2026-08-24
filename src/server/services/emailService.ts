import nodemailer from 'nodemailer';
import { prisma } from '../config/prisma';

export interface EmailParams {
  recipient: string;
  subject: string;
  content: string;
}

// Configure Nodemailer Transporter
const createTransporter = () => {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (host && user && user !== 'mock_user') {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  // Null/Mock transporter for local dev testing without external credentials
  return {
    sendMail: async (options: any) => {
      console.log(`[MOCK EMAIL SENT] To: ${options.to} | Subject: ${options.subject}`);
      return { messageId: `mock-msg-${Date.now()}` };
    }
  };
};

const transporter = createTransporter();

export async function sendEmailNotification(params: EmailParams): Promise<boolean> {
  const { recipient, subject, content } = params;
  const fromEmail = process.env.EMAIL_FROM || 'noreply@healthmanager.com';

  try {
    await transporter.sendMail({
      from: `"Healthcare Clinic" <${fromEmail}>`,
      to: recipient,
      subject: subject,
      text: content,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #0284c7;">Healthcare Clinic Notification</h2>
        <div style="white-space: pre-wrap; background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #0284c7;">
          ${content.replace(/\n/g, '<br/>')}
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </div>`
    });

    // Log success
    await prisma.notificationLog.create({
      data: {
        type: 'EMAIL',
        recipient,
        subject,
        content,
        status: 'SENT'
      }
    });

    return true;
  } catch (err: any) {
    console.error(`Email dispatch failed for ${recipient}:`, err?.message || err);

    // Log failure for retry queue
    await prisma.notificationLog.create({
      data: {
        type: 'EMAIL',
        recipient,
        subject,
        content,
        status: 'PENDING_RETRY',
        errorDetails: err?.message || String(err)
      }
    });

    return false;
  }
}

/**
 * Retry failed notification logs
 */
export async function processFailedNotificationRetries() {
  const pendingRetries = await prisma.notificationLog.findMany({
    where: {
      status: 'PENDING_RETRY',
      retryCount: { lt: 3 }
    },
    take: 10
  });

  for (const log of pendingRetries) {
    try {
      const success = await sendEmailNotification({
        recipient: log.recipient,
        subject: log.subject,
        content: log.content
      });

      if (success) {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'SENT', updatedAt: new Date() }
        });
      } else {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            retryCount: log.retryCount + 1,
            status: log.retryCount + 1 >= 3 ? 'FAILED' : 'PENDING_RETRY',
            updatedAt: new Date()
          }
        });
      }
    } catch (e: any) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          retryCount: log.retryCount + 1,
          status: log.retryCount + 1 >= 3 ? 'FAILED' : 'PENDING_RETRY',
          errorDetails: e?.message || String(e),
          updatedAt: new Date()
        }
      });
    }
  }
}
