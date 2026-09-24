import { clientIp, methodNotAllowed, readJsonBody, type VercelRequest, type VercelResponse } from '../_http.js';
import { createIdempotencyKey, enforceOpportunityRateLimit, validateConnectionSelection } from '../_opportunityEndpoint.js';

type RetailerSignupPayload = {
  scanId: string;
  selectedEans: string[];
  contact: { name: string; email: string };
};

function isPayload(value: unknown): value is RetailerSignupPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as RetailerSignupPayload;
  return typeof payload.scanId === 'string'
    && Array.isArray(payload.selectedEans)
    && payload.selectedEans.length >= 1
    && payload.selectedEans.length <= 20
    && payload.selectedEans.every((ean) => typeof ean === 'string' && ean.trim().length >= 8 && ean.trim().length <= 14)
    && payload.contact
    && typeof payload.contact.name === 'string'
    && payload.contact.name.trim().length > 0
    && payload.contact.name.trim().length <= 120
    && typeof payload.contact.email === 'string'
    && payload.contact.email.trim().length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact.email.trim());
}

function emailText(input: {
  name: string;
  email: string;
  shopUrl: string;
  market: string;
  products: Array<{ brand: string; title: string; ean: string }>;
}): string {
  const products = input.products.map((product) => `- ${product.brand || 'Catalogue product'}: ${product.title} (EAN ${product.ean})`).join('\n');
  return [
    'New EANrunner retailer enquiry',
    '',
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Webshop: ${input.shopUrl}`,
    `Market: ${input.market}`,
    '',
    'Selected products:',
    products,
  ].join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, 'POST');
    return;
  }

  const retryAfter = enforceOpportunityRateLimit(clientIp(req), 'retailer-signup');
  if (retryAfter) {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many requests. Please try again shortly.' });
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
  if (!isPayload(body)) {
    res.status(400).json({ code: 'INVALID_REQUEST', error: 'Enter your name and business email before continuing.' });
    return;
  }

  const selection = validateConnectionSelection({
    scanId: body.scanId,
    selectedEans: body.selectedEans,
    market: '',
  });
  if ('error' in selection) {
    res.status(400).json({ code: 'INVALID_REQUEST', error: selection.error });
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.RETAILER_SIGNUP_EMAIL_TO;
  const sender = process.env.RETAILER_SIGNUP_EMAIL_FROM;
  if (!resendApiKey || !recipient || !sender) {
    res.status(503).json({ code: 'EMAIL_UNAVAILABLE', error: 'Retailer onboarding is temporarily unavailable. Please try again later.' });
    return;
  }

  const products = selection.scan.opportunities
    .filter((product) => selection.selectedEans.includes(product.ean))
    .map(({ brand, title, ean }) => ({ brand, title, ean }));
  const idempotencyKey = createIdempotencyKey(selection.scan.id, selection.selectedEans, body.contact.email);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const email = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: body.contact.email,
        subject: `Retailer enquiry from ${body.contact.name} (${selection.scan.domain})`,
        text: emailText({
          name: body.contact.name.trim(),
          email: body.contact.email.trim(),
          shopUrl: selection.scan.url,
          market: selection.scan.market.toUpperCase(),
          products,
        }),
      }),
    });
    if (!email.ok && email.status !== 409) throw new Error(`Resend returned ${email.status}`);
    res.status(202).json({ requestId: idempotencyKey.slice(0, 16), status: 'accepted' });
  } catch {
    res.status(502).json({ code: 'EMAIL_FAILED', error: 'We could not send your enquiry. Please try again.' });
  } finally {
    clearTimeout(timeout);
  }
}
