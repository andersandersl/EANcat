import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function DistributorPricingPage() {
  useDocumentMeta({
    title: 'Distributor Pricing: 2% Commission',
    description: 'Distributor pricing from EANrunner: pay 2% commission only on sales generated through connected retailer channels.',
    path: '/pricing/distributors',
  });

  const openGmailCompose = () => {
    const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('info@eanrunner.com')}&su=${encodeURIComponent('Connect as distributor')}`;
    window.open(composeUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[hsl(220_22%_97%)] text-[hsl(222_47%_12%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[1180px] px-4 py-8 md:py-10">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pricing
        </Link>

        <section className="mt-6 rounded-3xl border border-[hsl(220_16%_88%)] bg-white px-6 py-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] md:px-8 md:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">Distributor pricing</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-[hsl(222_47%_10%)] md:text-4xl">
            Pay only when we create sales
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[hsl(220_12%_32%)]">
            EANrunner helps distributors get products into retailer channels without building every integration internally.
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-2xl border border-[hsl(220_16%_88%)] bg-[hsl(220_22%_99%)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_42%)]">Price</p>
              <p className="mt-3 text-[52px] font-black leading-none text-[hsl(221_92%_44%)]">2%</p>
              <p className="mt-1 text-sm font-semibold text-[hsl(222_47%_16%)]">of sales through EANrunner</p>
              <p className="mt-4 text-sm text-[hsl(220_12%_34%)]">No sales - no commission.</p>
              <button
                type="button"
                onClick={openGmailCompose}
                className="mt-6 inline-flex h-10 items-center rounded-lg bg-[hsl(221_92%_44%)] px-4 text-sm font-semibold text-white hover:bg-[hsl(221_92%_38%)]"
              >
                Connect as distributor
              </button>
            </article>

            <article className="rounded-2xl border border-[hsl(220_16%_88%)] bg-[hsl(220_22%_99%)] p-6">
              <h2 className="text-[22px] font-bold leading-tight text-[hsl(222_47%_12%)]">Included</h2>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-[hsl(220_12%_30%)]">
                <li>• We connect your products to retailers</li>
                <li>• We handle product data distribution</li>
                <li>• We manage stock and price feeds</li>
                <li>• We support order flow between parties</li>
                <li>• We give access to retailer sales channels</li>
              </ul>
            </article>
          </div>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
