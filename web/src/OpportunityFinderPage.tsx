import { useMemo, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadMoreOpportunityProducts, requestSupplierConnection, scanOpportunityShop } from './api';
import type { Opportunity, OpportunityScanResponse } from './types';
import { useDocumentMeta } from './useDocumentMeta';

type FinderState = 'initial' | 'scanning' | 'results' | 'error' | 'submitting' | 'success';

type Contact = { name: string; email: string; company: string; phone: string; consent: boolean };

const initialContact: Contact = { name: '', email: '', company: '', phone: '', consent: false };

function isLikelyUrl(value: string): boolean {
  try {
    const input = value.trim();
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
    if (hasScheme && !/^https?:\/\//i.test(input)) return false;
    const url = new URL(hasScheme ? input : `https://${input}`);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function formatPrice(opportunity: Opportunity): string | null {
  if (opportunity.marketPrice == null || !opportunity.marketCurrency) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: opportunity.marketCurrency, maximumFractionDigits: 0 }).format(opportunity.marketPrice);
}

function expectedMargin(opportunity: Opportunity): string | null {
  if (opportunity.marketPrice == null || opportunity.marketPrice <= 0 || !opportunity.marketCurrency) return null;
  const format = (amount: number) => new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: opportunity.marketCurrency!,
    maximumFractionDigits: 0,
  }).format(amount);
  switch (opportunity.marginGrade.toUpperCase()) {
    case 'A': return `More than ${format(opportunity.marketPrice * 0.2)}`;
    case 'B': return `${format(opportunity.marketPrice * 0.1)}–${format(opportunity.marketPrice * 0.2)}`;
    case 'C': return `${format(opportunity.marketPrice * 0.05)}–${format(opportunity.marketPrice * 0.1)}`;
    default: return null;
  }
}

export default function OpportunityFinderPage() {
  useDocumentMeta({
    title: 'Opportunity Finder | EANrunner',
    description: 'Find relevant public-catalogue products your webshop may be missing.',
    path: '/opportunity',
  });

  const [shopUrl, setShopUrl] = useState('');
  const [state, setState] = useState<FinderState>('initial');
  const [error, setError] = useState('');
  const [scan, setScan] = useState<OpportunityScanResponse | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedEans, setSelectedEans] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState('');
  const [contact, setContact] = useState<Contact>(initialContact);

  const visibleOpportunities = useMemo(
    () => scan?.opportunities.filter((item) => !category || item.category === category) ?? [],
    [category, scan],
  );

  const runScan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLikelyUrl(shopUrl)) {
      setState('error');
      setError('Enter a public http or https webshop URL without credentials.');
      return;
    }
    setState('scanning');
    setError('');
    setIsLoadingMore(false);
    setSelectedEans(new Set());
    try {
      const result = await scanOpportunityShop(shopUrl);
      setScan(result);
      setCategory('');
      setState('results');
    } catch (scanError) {
      setState('error');
      setError(scanError instanceof Error ? scanError.message : 'The webshop could not be scanned. Please try again.');
    }
  };

  const toggleSelection = (ean: string) => {
    setSelectedEans((current) => {
      const next = new Set(current);
      if (next.has(ean)) next.delete(ean);
      else next.add(ean);
      return next;
    });
  };

  const loadMore = async () => {
    if (!scan || !scan.hasMore || isLoadingMore) return;
    const { scanId, opportunities } = scan;
    setIsLoadingMore(true);
    setError('');
    try {
      const page = await loadMoreOpportunityProducts(scanId, opportunities.length);
      setScan((current) => {
        if (!current || current.scanId !== scanId) return current;
        const existingEans = new Set(current.opportunities.map((item) => item.ean));
        const additional = page.opportunities.filter((item) => !existingEans.has(item.ean));
        return { ...current, opportunities: [...current.opportunities, ...additional], hasMore: page.hasMore };
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'More opportunities could not be loaded. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const submitConnection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scan || selectedEans.size === 0 || !contact.consent) return;
    setState('submitting');
    setError('');
    try {
      await requestSupplierConnection({
        scanId: scan.scanId,
        shopUrl: scan.shop.url,
        market: scan.market.code,
        selectedEans: [...selectedEans],
        contact: { name: contact.name, email: contact.email, company: contact.company, ...(contact.phone ? { phone: contact.phone } : {}) },
        consent: true,
      });
      setState('success');
    } catch (requestError) {
      setState('results');
      setError(requestError instanceof Error ? requestError.message : 'We could not send your introduction request. Please try again.');
    }
  };

  const resultCategories = scan ? [...new Set(scan.opportunities.map((item) => item.category).filter(Boolean))] : [];

  return (
    <div className="min-h-screen bg-white text-[hsl(222_47%_12%)]">
      <header className="border-b border-[hsl(220_16%_91%)] bg-white">
        <div className="mx-auto flex min-h-14 w-full max-w-[1000px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center" aria-label="EANrunner home">
            <img src="/marketing/logo-ean.png" alt="EANrunner" className="h-6 w-auto object-contain" />
          </Link>
          <span className="text-xs font-semibold text-[hsl(221_92%_42%)]">Free for retailers</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1000px] px-4 pb-14 pt-12 sm:px-6 sm:pt-20">
        <section className="mx-auto max-w-[850px] text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-[hsl(142_44%_95%)] px-3 py-1 text-xs font-semibold text-[hsl(145_55%_28%)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> EANrunner Opportunity Finder
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.045em] text-[hsl(222_47%_10%)] sm:text-6xl sm:leading-[1.02]">
            Find profitable products your webshop is missing
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[hsl(220_14%_38%)] sm:text-lg">
            Enter your webshop URL. We analyse your assortment and find relevant products from EU suppliers only.
          </p>

          <form onSubmit={runScan} className="mx-auto mt-8 max-w-[720px]" noValidate>
            <label htmlFor="webshop-url" className="sr-only">Webshop URL</label>
            <div className="flex flex-col gap-3 rounded-2xl border border-[hsl(220_16%_85%)] bg-white p-2 shadow-[0_10px_28px_rgb(18_32_74/0.09)] sm:flex-row">
              <input
                id="webshop-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={shopUrl}
                onChange={(event) => setShopUrl(event.target.value)}
                placeholder="https://yourshop.com"
                aria-describedby={error && !scan ? 'scan-error' : 'scan-helper'}
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-4 text-base outline-none placeholder:text-[hsl(220_12%_59%)] focus:border-[hsl(145_55%_38%)] focus:ring-2 focus:ring-[hsl(145_55%_38%/0.22)]"
              />
              <button
                type="submit"
                disabled={state === 'scanning'}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[hsl(145_55%_34%)] px-5 text-sm font-bold text-white transition hover:bg-[hsl(145_55%_28%)] disabled:cursor-wait disabled:opacity-70"
              >
                {state === 'scanning' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                {state === 'scanning' ? 'Scanning your shop' : 'Find opportunities'}
              </button>
            </div>
            <p id="scan-helper" className="mt-3 text-sm text-[hsl(220_12%_48%)]">Free for retailers. No integration required.</p>
            {state === 'scanning' && <p className="mt-2 text-sm font-medium text-[hsl(145_55%_30%)]" aria-live="polite">Reading public pages and matching catalogue signals. This can take a few seconds.</p>}
            {error && !scan && <p id="scan-error" className="mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
          </form>
        </section>

        {scan && state !== 'success' && (
          <section className="mt-12" aria-labelledby="opportunity-results">
            <div className="rounded-2xl border border-[hsl(220_16%_87%)] bg-[hsl(220_26%_98%)] p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[hsl(220_12%_46%)]">Scan result</p>
                  <h2 id="opportunity-results" className="mt-1 text-2xl font-bold">Opportunities for {scan.shop.domain}</h2>
                  <p className="mt-2 text-sm text-[hsl(220_14%_38%)]">
                    Market: <strong>{scan.market.code}</strong> ({scan.market.confidence} confidence) · {scan.coverage.pagesScanned} public page{scan.coverage.pagesScanned === 1 ? '' : 's'} scanned
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[hsl(220_14%_32%)] shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-[hsl(145_55%_34%)]" aria-hidden="true" /> Public catalogue signals only
                </span>
              </div>
              {scan.detectedCategories.length > 0 && (
                <p className="mt-4 text-sm text-[hsl(220_14%_38%)]">
                  Selected shop categories, in priority order: {scan.detectedCategories.map((item) => item.sourceLabel).join(', ')}.
                </p>
              )}
              {scan.coverage.isPartial && (
                <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Limited scan coverage: {scan.coverage.warnings.join(' ') || 'Only part of the public webshop was available.'}</span>
                </div>
              )}
            </div>

            {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{error}</p>}

            {scan.opportunities.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[hsl(220_16%_82%)] p-8 text-center">
                <h3 className="text-lg font-bold">No suitable products found yet</h3>
                <p className="mt-2 text-sm text-[hsl(220_14%_42%)]">We could not find enough public catalogue matches from this limited scan. Try another public shop URL later.</p>
              </div>
            ) : (
              <>
                <div className="mt-7 flex flex-wrap gap-2" aria-label="Filter opportunities by category">
                  <button type="button" onClick={() => setCategory('')} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!category ? 'bg-[hsl(222_47%_14%)] text-white' : 'border border-[hsl(220_16%_84%)] bg-white text-[hsl(220_14%_35%)]'}`}>All categories</button>
                  {resultCategories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${category === item ? 'bg-[hsl(222_47%_14%)] text-white' : 'border border-[hsl(220_16%_84%)] bg-white text-[hsl(220_14%_35%)]'}`}>{item}</button>)}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {visibleOpportunities.map((opportunity) => {
                    const selected = selectedEans.has(opportunity.ean);
                    const price = formatPrice(opportunity);
                    const margin = expectedMargin(opportunity);
                    return (
                      <article key={opportunity.ean} className={`overflow-hidden rounded-2xl border bg-white transition ${selected ? 'border-[hsl(145_55%_40%)] ring-2 ring-[hsl(145_55%_40%/0.16)]' : 'border-[hsl(220_16%_87%)]'}`}>
                        <img src={opportunity.image || ''} alt="" className="h-44 w-full bg-[hsl(220_18%_96%)] object-contain p-4" />
                        <div className="p-4">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input type="checkbox" checked={selected} onChange={() => toggleSelection(opportunity.ean)} className="mt-1 h-4 w-4 accent-[hsl(145_55%_34%)]" />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_48%)]">{opportunity.brand || 'Catalogue product'}</span>
                              <span className="mt-1 block font-bold leading-snug text-[hsl(222_47%_14%)]">{opportunity.title}</span>
                            </span>
                          </label>
                          <p className="mt-3 text-xs text-[hsl(220_14%_43%)]">{opportunity.category} · EAN {opportunity.ean}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-[hsl(145_44%_94%)] px-2 py-1 text-[hsl(145_55%_27%)]">Margin grade {opportunity.marginGrade}</span>
                            <span className="rounded-full bg-[hsl(220_20%_95%)] px-2 py-1 text-[hsl(220_14%_36%)]">{opportunity.competitorCount} competitors</span>
                            <span className="rounded-full bg-[hsl(220_20%_95%)] px-2 py-1 text-[hsl(220_14%_36%)]">{opportunity.stockStatus}</span>
                          </div>
                          {price && <p className="mt-3 text-sm font-semibold text-[hsl(222_47%_17%)]">Market price: {price}</p>}
                          {margin && <p className="mt-1 text-sm font-semibold text-[hsl(145_55%_27%)]">Expected margin: {margin}</p>}
                          {margin && <p className="mt-1 text-xs leading-relaxed text-[hsl(220_14%_42%)]">Estimate based on market price and margin grade; supplier quotes may vary.</p>}
                          <p className="mt-3 text-sm leading-relaxed text-[hsl(220_14%_42%)]">{opportunity.reason}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {scan.hasMore && (
                  <div className="mt-7 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[hsl(145_55%_34%)] bg-white px-5 text-sm font-bold text-[hsl(145_55%_28%)] transition hover:bg-[hsl(145_44%_96%)] disabled:cursor-wait disabled:opacity-70"
                    >
                      {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {isLoadingMore ? 'Loading more' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}

            {selectedEans.size > 0 && (
              <form onSubmit={submitConnection} className="mt-8 rounded-2xl border border-[hsl(145_38%_73%)] bg-[hsl(145_44%_96%)] p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-xl font-bold">Connect me with suppliers</h3>
                    <p className="mt-1 text-sm text-[hsl(220_14%_39%)]">{selectedEans.size} selected product{selectedEans.size === 1 ? '' : 's'}. EANrunner will arrange the requested introduction.</p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-[hsl(145_55%_28%)]"><Check className="h-4 w-4" aria-hidden="true" /> Your choices stay in control</span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">Contact name<input required value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} className="mt-1.5 block min-h-11 w-full rounded-lg border border-[hsl(220_16%_82%)] bg-white px-3 font-normal outline-none focus:border-[hsl(145_55%_38%)] focus:ring-2 focus:ring-[hsl(145_55%_38%/0.18)]" /></label>
                  <label className="text-sm font-semibold">Business email<input required type="email" autoComplete="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} className="mt-1.5 block min-h-11 w-full rounded-lg border border-[hsl(220_16%_82%)] bg-white px-3 font-normal outline-none focus:border-[hsl(145_55%_38%)] focus:ring-2 focus:ring-[hsl(145_55%_38%/0.18)]" /></label>
                  <label className="text-sm font-semibold">Company name<input required autoComplete="organization" value={contact.company} onChange={(event) => setContact({ ...contact, company: event.target.value })} className="mt-1.5 block min-h-11 w-full rounded-lg border border-[hsl(220_16%_82%)] bg-white px-3 font-normal outline-none focus:border-[hsl(145_55%_38%)] focus:ring-2 focus:ring-[hsl(145_55%_38%/0.18)]" /></label>
                  <label className="text-sm font-semibold">Phone <span className="font-normal text-[hsl(220_12%_47%)]">(optional)</span><input type="tel" autoComplete="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} className="mt-1.5 block min-h-11 w-full rounded-lg border border-[hsl(220_16%_82%)] bg-white px-3 font-normal outline-none focus:border-[hsl(145_55%_38%)] focus:ring-2 focus:ring-[hsl(145_55%_38%/0.18)]" /></label>
                </div>
                <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[hsl(220_14%_37%)]"><input required type="checkbox" checked={contact.consent} onChange={(event) => setContact({ ...contact, consent: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[hsl(145_55%_34%)]" />I consent to EANrunner using this information to arrange the requested supplier introduction.</label>
                <button type="submit" disabled={state === 'submitting'} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[hsl(145_55%_34%)] px-5 text-sm font-bold text-white hover:bg-[hsl(145_55%_28%)] disabled:cursor-wait disabled:opacity-70">
                  {state === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{state === 'submitting' ? 'Sending request' : 'Connect me with suppliers'}
                </button>
              </form>
            )}
          </section>
        )}

        {state === 'success' && (
          <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-[hsl(145_38%_72%)] bg-[hsl(145_44%_96%)] p-8 text-center" aria-live="polite">
            <Check className="mx-auto h-10 w-10 rounded-full bg-[hsl(145_55%_34%)] p-2 text-white" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-bold">Request received</h2>
            <p className="mt-3 text-[hsl(220_14%_38%)]">Thank you. EANrunner has received your request and will contact the relevant suppliers.</p>
          </section>
        )}

        <section className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            ['Always free for retailers', 'Use the finder without an account or integration.'],
            ['EU suppliers only', 'We match public catalogue signals to relevant product opportunities from EU suppliers.'],
            ['You stay in control', 'Choose the products before requesting any introduction.'],
          ].map(([title, description]) => <div key={title} className="rounded-xl bg-[hsl(220_24%_98%)] p-5"><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-[hsl(220_14%_42%)]">{description}</p></div>)}
        </section>

        <section className="mt-14 rounded-2xl bg-[hsl(220_24%_98%)] p-6 sm:p-8">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <ol className="mt-6 grid gap-5 sm:grid-cols-3">{['You share your shop URL', 'We compare your assortment', 'You get an opportunity list'].map((item, index) => <li key={item} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-[hsl(145_55%_30%)]">{index + 1}</span><span className="pt-1 text-sm font-semibold">{item}</span></li>)}</ol>
        </section>
      </main>

      <footer className="border-t border-[hsl(220_16%_91%)] px-4 py-7 text-center text-xs leading-relaxed text-[hsl(220_12%_48%)]">
        EANrunner introduces retailers to suppliers. EANrunner does not handle product orders, payments, delivery, or customer service.
      </footer>
    </div>
  );
}
