import { methodNotAllowed, readJsonBody, type VercelRequest, type VercelResponse } from '../_http.js';
import { getOpportunityPage, MAX_STORED_OPPORTUNITIES, OPPORTUNITY_PAGE_SIZE } from '../_opportunityEndpoint.js';

function parseBody(body: unknown): { scanId: string; offset: number } | null {
  if (!body || typeof body !== 'object') return null;
  const { scanId, offset } = body as { scanId?: unknown; offset?: unknown };
  const parsedOffset = typeof offset === 'number' ? offset : Number.parseInt(String(offset), 10);
  if (
    typeof scanId !== 'string'
    || !Number.isInteger(parsedOffset)
    || parsedOffset < 0
    || parsedOffset > MAX_STORED_OPPORTUNITIES
    || parsedOffset % OPPORTUNITY_PAGE_SIZE !== 0
  ) {
    return null;
  }
  return { scanId, offset: parsedOffset };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, 'POST');
    return;
  }

  const parsed = parseBody(await readJsonBody(req).catch(() => null));
  if (!parsed) {
    res.status(400).json({ code: 'INVALID_REQUEST', error: 'The results page is invalid.' });
    return;
  }

  const page = getOpportunityPage(parsed.scanId, parsed.offset);
  if (!page) {
    res.status(404).json({ code: 'SCAN_EXPIRED', error: 'This scan has expired. Please scan the webshop again.' });
    return;
  }
  res.status(200).json(page);
}
