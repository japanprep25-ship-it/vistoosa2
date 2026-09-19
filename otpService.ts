import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

const OTP_FILE_PATH = path.join(process.cwd(), 'otp-records.json');

export interface OtpRecord {
  email: string;
  otpCode: string;
  expiresAt: number;
  type: 'login' | 'signup' | 'forgot_password';
  attempts: number;
  createdAt: string;
}

type OtpMap = Record<string, OtpRecord>;

function loadOtps(): OtpMap {
  try {
    if (!fs.existsSync(OTP_FILE_PATH)) return {};
    const data = fs.readFileSync(OTP_FILE_PATH, 'utf-8');
    return JSON.parse(data) as OtpMap;
  } catch (err) {
    return {};
  }
}

function saveOtps(otps: OtpMap): void {
  try {
    fs.writeFileSync(OTP_FILE_PATH, JSON.stringify(otps, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save OTP records:', err);
  }
}

// Generate 6-digit random numeric string
export function generateRandom6DigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via Nodemailer using Gmail SMTP if credentials exist.
 * Fallback to logging in server console and returning preview code.
 */
export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  type: 'login' | 'signup' | 'forgot_password'
): Promise<{ sentViaEmail: boolean; message: string; debugOtp?: string }> {
  const cleanEmail = toEmail.trim().toLowerCase();
  const gmailSender = process.env.GMAIL_SENDER_ADDRESS;
  const gmailAppPass = process.env.GMAIL_APP_PASSWORD;

  const subjectMap = {
    login: 'Your Vistoosa OS Login Verification Code',
    signup: 'Verify Your New Vistoosa OS Account',
    forgot_password: 'Reset Password Verification Code - Vistoosa OS',
  };

  const subject = `${subjectMap[type]}: ${otpCode}`;

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

  if (gmailSender && gmailAppPass && gmailSender.includes('@') && gmailAppPass.trim().length >= 8) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailSender.trim(),
          pass: gmailAppPass.trim().replace(/\s+/g, ''),
        },
      });

      await transporter.sendMail({
        from: `"Vistoosa OS Security" <${gmailSender.trim()}>`,
        to: cleanEmail,
        subject,
        html: htmlBody,
      });

      console.log(`[SMTP Mail Success]: OTP ${otpCode} sent to ${cleanEmail}`);
      return {
        sentViaEmail: true,
        message: `OTP verification code sent to ${cleanEmail}`,
      };
    } catch (err: any) {
      console.warn(`[SMTP Mail Warning]: Failed to send email via Gmail SMTP:`, err?.message || err);
      // Fallback to console debug
    }
  }

  // Fallback for dev / preview mode when SMTP credentials are not set
  console.log(`\n==============================================`);
  console.log(`[OTP GENERATED for ${cleanEmail}]: ${otpCode}`);
  console.log(`Type: ${type} | Valid for 10 minutes`);
  console.log(`==============================================\n`);

  return {
    sentViaEmail: false,
    message: `OTP generated for ${cleanEmail}. (Check server log or preview fallback code: ${otpCode})`,
    debugOtp: otpCode,
  };
}

/**
 * Generate, save, and dispatch OTP to user email
 */
export async function createAndSendOtp(
  email: string,
  type: 'login' | 'signup' | 'forgot_password'
): Promise<{ success: boolean; message: string; expiresAt: number; debugOtp?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const otpCode = generateRandom6DigitOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

  const otps = loadOtps();
  otps[cleanEmail] = {
    email: cleanEmail,
    otpCode,
    expiresAt,
    type,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  saveOtps(otps);

  const mailResult = await sendOtpEmail(cleanEmail, otpCode, type);

  return {
    success: true,
    message: mailResult.sentViaEmail
      ? `A 6-digit OTP verification code has been sent to ${cleanEmail}.`
      : `OTP verification code dispatched.`,
    expiresAt,
    debugOtp: mailResult.debugOtp,
  };
}

/**
 * Verify OTP submitted by user
 */
export function verifyOtpCode(
  email: string,
  code: string
): { success: boolean; message: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  const otps = loadOtps();
  const record = otps[cleanEmail];

  if (!record) {
    return {
      success: false,
      message: 'No OTP code found for this email. Please click "Resend OTP".',
    };
  }

  if (Date.now() > record.expiresAt) {
    delete otps[cleanEmail];
    saveOtps(otps);
    return {
      success: false,
      message: 'OTP verification code has expired. Please click "Resend OTP".',
    };
  }

  if (record.otpCode !== cleanCode) {
    record.attempts += 1;
    saveOtps(otps);
    return {
      success: false,
      message: 'Invalid OTP code. Please check your email and try again.',
    };
  }

  // Clear OTP on successful verification
  delete otps[cleanEmail];
  saveOtps(otps);

  return {
    success: true,
    message: 'OTP verified successfully.',
  };
}
