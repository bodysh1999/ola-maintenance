import 'server-only';

/**
 * Outside-channel senders. Configure on Vercel (Settings → Environment Variables):
 *
 *   SMS_PROVIDER       = taqnyat | unifonic | twilio | log
 *   WHATSAPP_PROVIDER  = meta | twilio | log
 *   EMAIL_PROVIDER     = resend | log
 *
 *   Taqnyat:   TAQNYAT_TOKEN, TAQNYAT_SENDER            (sender name approved by CITC)
 *   Unifonic:  UNIFONIC_APP_SID, UNIFONIC_SENDER
 *   Twilio:    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM (e.g. whatsapp:+14155238886)
 *   Meta WhatsApp Cloud API:
 *              WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE (approved template, one body variable {{1}}),
 *              WHATSAPP_TEMPLATE_LANG (default ar)
 *   Resend:    RESEND_API_KEY, EMAIL_FROM (e.g. "علا التميز <noreply@your-domain.sa>")
 *
 * "log" prints the message in the Vercel logs instead of sending (useful for testing).
 */

export type Channel = 'sms' | 'whatsapp' | 'email';
export type Outgoing = { to: string; text: string; subject?: string };
export type SendResult = { ok: true } | { ok: false; error: string; permanent?: boolean };

const env = (k: string) => process.env[k]?.trim() || '';

export function providerFor(channel: Channel): string {
  return env(channel === 'sms' ? 'SMS_PROVIDER' : channel === 'whatsapp' ? 'WHATSAPP_PROVIDER' : 'EMAIL_PROVIDER').toLowerCase();
}

export function anyProviderConfigured() {
  return (['sms', 'whatsapp', 'email'] as const).some((c) => !!providerFor(c));
}

/** Saudi numbers to international digits: 05XXXXXXXX / +9665… / 009665… → 9665XXXXXXXX */
export function normalizeMsisdn(raw: string | null | undefined): string | null {
  let p = (raw ?? '').replace(/[^\d+]/g, '');
  if (!p) return null;
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('05') && p.length === 10) p = '966' + p.slice(1);
  if (p.startsWith('5') && p.length === 9) p = '966' + p;
  return /^\d{8,15}$/.test(p) ? p : null;
}

async function post(url: string, init: RequestInit): Promise<SendResult> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    if (r.ok) return { ok: true };
    const body = (await r.text()).slice(0, 300);
    return { ok: false, error: `HTTP ${r.status}: ${body}`, permanent: r.status >= 400 && r.status < 500 && r.status !== 429 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const basic = (u: string, p: string) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

export async function send(channel: Channel, msg: Outgoing): Promise<SendResult> {
  const provider = providerFor(channel);
  if (!provider) return { ok: false, error: 'NOT_CONFIGURED', permanent: true };

  if (provider === 'log') {
    console.log(`[notify:${channel}] → ${msg.to}\n${msg.subject ? msg.subject + '\n' : ''}${msg.text}`);
    return { ok: true };
  }

  if (channel === 'email') {
    if (provider === 'resend') {
      return post('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env('EMAIL_FROM'), to: [msg.to], subject: msg.subject ?? '', text: msg.text }),
      });
    }
    return { ok: false, error: `UNKNOWN_PROVIDER ${provider}`, permanent: true };
  }

  const to = normalizeMsisdn(msg.to);
  if (!to) return { ok: false, error: 'INVALID_PHONE', permanent: true };

  if (channel === 'sms') {
    if (provider === 'taqnyat') {
      return post('https://api.taqnyat.sa/v1/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('TAQNYAT_TOKEN')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: [to], body: msg.text, sender: env('TAQNYAT_SENDER') }),
      });
    }
    if (provider === 'unifonic') {
      return post('https://el.cloud.unifonic.com/rest/SMS/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ AppSid: env('UNIFONIC_APP_SID'), SenderID: env('UNIFONIC_SENDER'), Recipient: to, Body: msg.text }),
      });
    }
    if (provider === 'twilio') {
      return post(`https://api.twilio.com/2010-04-01/Accounts/${env('TWILIO_ACCOUNT_SID')}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: basic(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN')), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: env('TWILIO_SMS_FROM'), To: '+' + to, Body: msg.text }),
      });
    }
  }

  if (channel === 'whatsapp') {
    if (provider === 'meta') {
      // business-initiated WhatsApp messages must use an approved template; the whole text goes in {{1}}
      const param = msg.text.replace(/\s*\n+\s*/g, ' — ').slice(0, 1000);
      return post(`https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_ID')}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to, type: 'template',
          template: {
            name: env('WHATSAPP_TEMPLATE') || 'ola_update',
            language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'ar' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: param }] }],
          },
        }),
      });
    }
    if (provider === 'twilio') {
      return post(`https://api.twilio.com/2010-04-01/Accounts/${env('TWILIO_ACCOUNT_SID')}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: basic(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN')), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: env('TWILIO_WHATSAPP_FROM'), To: 'whatsapp:+' + to, Body: msg.text }),
      });
    }
  }

  return { ok: false, error: `UNKNOWN_PROVIDER ${provider}`, permanent: true };
}
