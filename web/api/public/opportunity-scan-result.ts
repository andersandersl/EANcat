import { methodNotAllowed, readJsonBody, type VercelRequest, type VercelResponse } from '../_http.js';
import { getOpportunityResult } from '../_opportunityEndpoint.js';

function parseScanId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const scanId = (body as { scanId?: unknown }).scanId;
  return typeof scanId === 'string' && scanId.length > 0 ? scanId : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, 'POST');
    return;
  }

  const scanId = parseScanId(await readJsonBody(req).catch(() => null));
  if (!scanId) {
    res.status(400).json({ code: 'INVALID_REQUEST', error: 'The shared result link is invalid.' });
    return;
  }

  const result = getOpportunityResult(scanId);
  if (!result) {
    res.status(404).json({ code: 'SCAN_EXPIRED', error: 'This shared scan has expired. Please scan the webshop again.' });
    return;
  }
  res.status(200).json(result);
}
