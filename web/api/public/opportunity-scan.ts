import { clientIp, methodNotAllowed, readJsonBody, type VercelRequest, type VercelResponse } from '../_http.js';
import { createOpportunityScan, enforceOpportunityRateLimit, mapOpportunityError } from '../_opportunityEndpoint.js';

function parseScanUrl(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const url = (body as { url?: unknown }).url;
  return typeof url === 'string' && url.trim().length > 0 && url.length <= 2048 ? url : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, 'POST');
    return;
  }

  const retryAfter = enforceOpportunityRateLimit(clientIp(req), 'scan');
  if (retryAfter) {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many scan requests. Please try again shortly.' });
    return;
  }

  let scanCompleted = false;
  try {
    const url = parseScanUrl(await readJsonBody(req));
    if (!url) {
      res.status(400).json({ code: 'INVALID_REQUEST', error: 'Enter a valid webshop URL.' });
      return;
    }
    const scan = await createOpportunityScan(url);
    scanCompleted = true;
    res.status(200).json(scan);
  } catch (error) {
    const mapped = mapOpportunityError(error, scanCompleted);
    res.status(mapped.status).json({ code: mapped.code, error: mapped.message });
  }
}
