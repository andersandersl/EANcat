import { clientIp, methodNotAllowed, readJsonBody, type VercelRequest, type VercelResponse } from '../_http.js';
import { createOpportunityScan, enforceOpportunityRateLimit, mapOpportunityError } from '../_opportunityEndpoint.js';

function parseScanRequest(body: unknown): { url: string; market: 'dk' | 'se' | 'fi' } | null {
  if (!body || typeof body !== 'object') return null;
  const { url, market } = body as { url?: unknown; market?: unknown };
  if (
    typeof url !== 'string'
    || url.trim().length === 0
    || url.length > 2048
    || !['dk', 'se', 'fi'].includes(String(market))
  ) {
    return null;
  }
  return { url, market: market as 'dk' | 'se' | 'fi' };
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
    const request = parseScanRequest(await readJsonBody(req));
    if (!request) {
      res.status(400).json({ code: 'INVALID_REQUEST', error: 'Enter a valid webshop URL and country.' });
      return;
    }
    const scan = await createOpportunityScan(request.url, request.market);
    scanCompleted = true;
    res.status(200).json(scan);
  } catch (error) {
    const mapped = mapOpportunityError(error, scanCompleted);
    res.status(mapped.status).json({ code: mapped.code, error: mapped.message });
  }
}
