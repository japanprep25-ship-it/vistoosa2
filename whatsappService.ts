// whatsappService.ts
// -----------------------------------------------------------------------
// WhatsApp Cloud API Integration & Notification Service
//
// Saves & loads config from `whatsapp-config.json` (or environment variables)
// and handles sending automated order tracking notifications via Meta WhatsApp API.

import fs from 'fs';
import path from 'path';
import type { Express, Request, Response } from 'express';

const CONFIG_PATH = path.join(process.cwd(), 'whatsapp-config.json');

export interface WhatsappConfig {
  phoneNumberId: string;
  accessToken: string;
  templateName: string;
  languageCode: string;
}

export function loadWhatsappConfig(): WhatsappConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveWhatsappConfig(config: WhatsappConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function mountWhatsappRoutes(app: Express) {
  // POST /api/settings/whatsapp -> Save WhatsApp credentials
  app.post('/api/settings/whatsapp', (req: Request, res: Response) => {
    const { phoneNumberId, accessToken, templateName, languageCode } = req.body || {};

    if (!phoneNumberId || !accessToken || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'Phone Number ID, Access Token, and Template Name are required.',
      });
    }

    // Preserve existing access token if user didn't modify masked value '••••••••'
    let tokenToSave = accessToken;
    if (accessToken === '••••••••') {
      const existing = loadWhatsappConfig();
      if (existing) tokenToSave = existing.accessToken;
    }

    saveWhatsappConfig({
      phoneNumberId: String(phoneNumberId).trim(),
      accessToken: String(tokenToSave).trim(),
      templateName: String(templateName).trim(),
      languageCode: String(languageCode || 'en_US').trim(),
    });

    return res.json({
      success: true,
      message: 'WhatsApp Cloud API settings saved successfully.',
    });
  });

  // GET /api/settings/whatsapp -> Prefill settings form
  app.get('/api/settings/whatsapp', (_req: Request, res: Response) => {
    const config = loadWhatsappConfig();

    // Fallback to env variables if available
    const phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const templateName = config?.templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'vistoosa_order_tracking';
    const languageCode = config?.languageCode || process.env.WHATSAPP_LANGUAGE_CODE || 'en_US';
    const hasToken = !!(config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN);

    if (!config && !hasToken && !phoneNumberId) {
      return res.json({ configured: false });
    }

    return res.json({
      configured: true,
      phoneNumberId,
      templateName,
      languageCode,
      accessToken: hasToken ? '••••••••' : '',
    });
  });

  // POST /api/settings/whatsapp/test -> Send test WhatsApp message
  app.post('/api/settings/whatsapp/test', async (req: Request, res: Response) => {
    const { testPhone, customerName, trackingId } = req.body || {};
    try {
      const result = await sendTrackingWhatsapp(
        testPhone || '01700000000',
        customerName || 'Valued Customer',
        trackingId || 'PTH-TEST-123456'
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to send test WhatsApp message',
      });
    }
  });
}

/**
 * Clean & format phone number to international format (e.g., 8801700000000 for Bangladesh)
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    cleaned = '88' + cleaned;
  }
  return cleaned;
}

/**
 * Sends automated Pathao tracking ID to customer via Meta WhatsApp Cloud API
 */
export async function sendTrackingWhatsapp(
  recipientPhone: string,
  customerName: string,
  trackingId: string
) {
  const config = loadWhatsappConfig();
  const phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = config?.templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'vistoosa_order_tracking';
  const languageCode = config?.languageCode || process.env.WHATSAPP_LANGUAGE_CODE || 'en_US';

  if (!phoneNumberId || !accessToken) {
    console.warn('[WhatsApp Service]: Phone Number ID or Access Token is missing in configuration.');
    return {
      success: false,
      message: 'WhatsApp API credentials not configured in Settings.',
    };
  }

  const formattedPhone = formatPhoneNumber(recipientPhone);
  if (!formattedPhone) {
    return {
      success: false,
      message: 'Invalid customer phone number provided.',
    };
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName || 'Valued Customer' },
            { type: 'text', text: trackingId },
          ],
        },
      ],
    },
  };

  try {
    console.log(`[WhatsApp API]: Sending tracking code ${trackingId} to ${formattedPhone}...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[WhatsApp API Error]:', data);
      return {
        success: false,
        error: data,
        message: `WhatsApp API Error: ${data?.error?.message || res.statusText}`,
      };
    }

    console.log(`[WhatsApp Success]: Message sent successfully to ${formattedPhone}. Message ID: ${data?.messages?.[0]?.id}`);
    return {
      success: true,
      messageId: data?.messages?.[0]?.id,
      data,
    };
  } catch (err: any) {
    console.error('[WhatsApp Network Error]:', err?.message || err);
    return {
      success: false,
      error: err?.message || err,
      message: `Failed to connect to Meta WhatsApp Cloud API: ${err?.message || 'Network error'}`,
    };
  }
}
