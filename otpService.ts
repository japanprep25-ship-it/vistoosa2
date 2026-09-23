import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { db } from './firebaseAdmin';

const OTP_COLLECTION = 'otps';

export interface OtpRecord {
  email: string;
  otpCode: string;
  expiresAt: number;
  type: 'login' | 'signup' | 'forgot_password';
  attempts: number;
  createdAt: string;
}

// Generate 6-digit random numeric string
export function generateRandom6DigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via Resend HTTP API (preferred) or Gmail SMTP (fallback) if credentials exist.
 */
export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  type: 'login' | 'signup' | 'forgot_password'
): Promise<{ sentViaEmail: boolean; message: string; debugOtp?: string }> {
  const cleanEmail = toEmail.trim().toLowerCase();
  const resendApiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : '';
  const senderAddress = process.env.RESEND_SENDER_ADDRESS
    ? process.env.RESEND_SENDER_ADDRESS.trim()
    : 'Vistoosa Security <onboarding@resend.dev>';

  const gmailSender = process.env.GMAIL_SENDER_ADDRESS ? process.env.GMAIL_SENDER_ADDRESS.trim() : '';
  const gmailAppPass = process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.trim().replace(/\s+/g, '') : '';

  const subjectMap = {
    login: 'Your Vistoosa OS Login Verification Code',
    signup: 'Verify Your New Vistoosa OS Account',
    forgot_password: 'Reset Password Verification Code - Vistoosa OS',
  };

  const subject = `${subjectMap[type] || 'Verification Code'}: ${otpCode}`;

  const htmlBody = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 32px; border-radius: 16px; max-width: 520px; margin: 0 auto; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f59e0b; margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">VISTOOSA OS</h1>
        <p style="color: #71717a; font-size: 12px; margin-top: 4px;">Fulfillment & Management System</p>
      </div>
      <div style="background-color: #18181b; padding: 24px; border-radius: 12px; border: 1px solid #3f3f46; text-align: center;">
        <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 12px;">Your 6-Digit One-Time Password (OTP):</p>
        <div style="font-size: 36px; font-weight: 800; color: #f59e0b; letter-spacing: 8px; font-family: monospace; padding: 12px; background-color: #09090b; border-radius: 8px; border: 1px solid #d97706; display: inline-block; margin: 8px 0;">
          ${otpCode}
        </div>
        <p style="color: #71717a; font-size: 12px; margin-top: 16px;">This OTP code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
      </div>
      <p style="color: #52525b; font-size: 11px; text-align: center; margin-top: 24px;">If you did not request this code, please ignore this email.</p>
    </div>
  `;

  // 1. Prefer Resend HTTP API
  if (resendApiKey) {
    console.log(`Attempting to send OTP email to ${cleanEmail} via Resend HTTP API`);
    try {
      const resend = new Resend(resendApiKey);
      const { data, error } = await resend.emails.send({
        from: senderAddress,
        to: cleanEmail,
        subject,
        html: htmlBody,
      });

      if (error) {
        console.error(`Failed to send OTP email to ${cleanEmail} via Resend API. Error:`, error);
        return {
          sentViaEmail: false,
          message: `Failed to send email via Resend API: ${error.message || JSON.stringify(error)}. (Code generated: ${otpCode})`,
          debugOtp: otpCode,
        };
      }

      console.log(`Email sent successfully to ${cleanEmail} via Resend API (Message ID: ${data?.id || 'N/A'})`);
      return {
        sentViaEmail: true,
        message: `OTP verification code sent to ${cleanEmail}`,
      };
    } catch (err: any) {
      console.error(`Failed to send OTP email to ${cleanEmail} via Resend API. Error code: ${err?.code || 'UNKNOWN'}, Message: ${err?.message || err}`);
      console.error(`[Resend API Error Stack]:`, err);

      return {
        sentViaEmail: false,
        message: `Failed to send email via Resend API: ${err?.message || 'API Error'}. (Code generated: ${otpCode})`,
        debugOtp: otpCode,
      };
    }
  }

  // 2. Fallback to Gmail SMTP if Nodemailer credentials provided
  if (gmailSender && gmailAppPass) {
    console.log(`Attempting to send OTP email to ${cleanEmail} via Gmail SMTP`);
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailSender,
          pass: gmailAppPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"Vistoosa OS Security" <${gmailSender}>`,
        to: cleanEmail,
        subject,
        html: htmlBody,
      });

      console.log(`Email sent successfully to ${cleanEmail} (Message ID: ${info?.messageId || 'N/A'})`);
      return {
        sentViaEmail: true,
        message: `OTP verification code sent to ${cleanEmail}`,
      };
    } catch (err: any) {
      console.error(`Failed to send OTP email to ${cleanEmail} via Gmail SMTP. Error code: ${err?.code || 'UNKNOWN'}, Message: ${err?.message || err}`);
      console.error(`[Gmail SMTP Error Stack]:`, err);

      return {
        sentViaEmail: false,
        message: `Failed to send email via Gmail SMTP: ${err?.message || 'SMTP Error'}. (Code generated: ${otpCode})`,
        debugOtp: otpCode,
      };
    }
  }

  // 3. No email credentials configured on environment
  console.warn(`No RESEND_API_KEY or Gmail SMTP credentials found in environment variables. Cannot send email to ${cleanEmail}.`);
  console.log(`[OTP GENERATED for ${cleanEmail}]: ${otpCode}`);

  return {
    sentViaEmail: false,
    message: `Email credentials missing in environment variables. OTP generated: ${otpCode}`,
    debugOtp: otpCode,
  };
}

/**
 * Generate, save to Firestore, and dispatch OTP to user email
 */
export async function createAndSendOtp(
  email: string,
  type: 'login' | 'signup' | 'forgot_password'
): Promise<{ success: boolean; message: string; expiresAt: number; debugOtp?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const otpCode = generateRandom6DigitOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

  const record: OtpRecord = {
    email: cleanEmail,
    otpCode,
    expiresAt,
    type,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = db.collection(OTP_COLLECTION).doc(cleanEmail);
    await docRef.set(record);
  } catch (err: any) {
    console.error(`[OtpService]: Error saving OTP to Firestore for ${cleanEmail}:`, err?.message || err, err);
  }

  const mailResult = await sendOtpEmail(cleanEmail, otpCode, type);

  return {
    success: true,
    message: mailResult.sentViaEmail
      ? `A 6-digit OTP verification code has been sent to ${cleanEmail}.`
      : `OTP verification code generated. ${mailResult.message}`,
    expiresAt,
    debugOtp: mailResult.debugOtp,
  };
}

/**
 * Verify OTP submitted by user against Firestore
 */
export async function verifyOtpCode(
  email: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  try {
    const docRef = db.collection(OTP_COLLECTION).doc(cleanEmail);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        success: false,
        message: 'No OTP code found for this email. Please click "Resend OTP".',
      };
    }

    const record = doc.data() as OtpRecord;

    if (Date.now() > record.expiresAt) {
      await docRef.delete();
      return {
        success: false,
        message: 'OTP verification code has expired. Please click "Resend OTP".',
      };
    }

    if (record.otpCode !== cleanCode) {
      await docRef.update({ attempts: (record.attempts || 0) + 1 });
      return {
        success: false,
        message: 'Invalid OTP code. Please check your email and try again.',
      };
    }

    // Clear OTP on successful verification
    await docRef.delete();

    return {
      success: true,
      message: 'OTP verified successfully.',
    };
  } catch (err: any) {
    console.error(`[OtpService]: verifyOtpCode error for ${cleanEmail}:`, err?.message || err, err);
    return {
      success: false,
      message: 'Error verifying OTP code.',
    };
  }
}
