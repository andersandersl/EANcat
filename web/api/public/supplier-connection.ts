import { clientIp, methodNotAllowed, readJsonBody, type VercelRequest, type VercelResponse } from '../_http.js';
import { createIdempotencyKey, enforceOpportunityRateLimit, validateConnectionSelection } from '../_opportunityEndpoint.js';

type Contact = { name: string; email: string; company: string; phone?: string };

type SupplierConnectionPayload = {
  scanId: string;
  shopUrl: string;
  market: 'DK' | 'SE' | 'FI';
  selectedEans: string[];
  contact: Contact;
  consent: true;
};

function isPayload(value: unknown): value is SupplierConnectionPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as SupplierConnectionPayload;
  return typeof payload.scanId === 'string'
    && typeof payload.shopUrl === 'string'
    && ['DK', 'SE', 'FI'].includes(payload.market)
    && Array.isArray(payload.selectedEans)
    && payload.selectedEans.length >= 1
    && payload.selectedEans.length <= 20
    && payload.selectedEans.every((ean) => typeof ean === 'string' && ean.trim().length >= 8 && ean.trim().length <= 14)
    && payload.contact
    && typeof payload.contact.name === 'string'
    && payload.contact.name.trim().length > 0
    && typeof payload.contact.email === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact.email)
    && typeof payload.contact.company === 'string'
    && payload.contact.company.trim().length > 0
    && payload.consent === true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, 'POST');
    return;
  }

  const retryAfter = enforceOpportunityRateLimit(clientIp(req), 'connection');
  if (retryAfter) {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many connection requests. Please try again shortly.' });
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
  if (!isPayload(body)) {
    res.status(400).json({ code: 'INVALID_REQUEST', error: 'Complete the required contact details and consent before continuing.' });
    return;
  }

  const selection = validateConnectionSelection(body);
  if ('error' in selection) {
    res.status(400).json({ code: 'INVALID_REQUEST', error: selection.error });
    return;
  }

  const handoffUrl = process.env.EANRUNNER_OPPORTUNITY_API_URL;
  const handoffToken = process.env.EANRUNNER_OPPORTUNITY_API_TOKEN;
  if (!handoffUrl || !handoffToken) {
    res.status(503).json({ code: 'HANDOFF_UNAVAILABLE', error: 'Supplier introductions are temporarily unavailable. Please try again later.' });
    return;
  }

  const idempotencyKey = createIdempotencyKey(selection.scan.id, selection.selectedEans, body.contact.email);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const handoff = await fetch(handoffUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${handoffToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        scanId: selection.scan.id,
        shopUrl: selection.scan.url,
        market: selection.scan.market.toUpperCase(),
        selectedEans: selection.selectedEans,
        contact: body.contact,
        consent: { granted: true, timestamp: new Date().toISOString() },
      }),
    });
    if (!handoff.ok && handoff.status !== 409) {
      throw new Error(`Private handoff returned ${handoff.status}`);
    }
    res.status(202).json({ requestId: idempotencyKey.slice(0, 16), status: 'accepted' });
  } catch {
    res.status(502).json({ code: 'HANDOFF_FAILED', error: 'We could not send your introduction request. Your selected products are still available below; please try again.' });
  } finally {
    clearTimeout(timeout);
  }
}
