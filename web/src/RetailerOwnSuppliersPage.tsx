import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function RetailerOwnSuppliersPage() {
  useDocumentMeta({
    title: 'Retailer Pricing for Own Suppliers',
    description: 'See EANrunner pricing for retailers managing their own suppliers, including per-product pricing and minimum monthly spend.',
    path: '/pricing/retailers/own-suppliers',
  });

  const openGmailCompose = () => {
    const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('info@eanrunner.com')}&su=${encodeURIComponent('Manage my own suppliers with EANrunner')}`;
    window.open(composeUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[hsl(220_22%_97%)] text-[hsl(222_47%_12%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[1180px] px-4 py-8 md:py-10">
        <Link
          to="/pricing/retailers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to retailer pricing
        </Link>

        <section className="mt-6 rounded-3xl border border-[hsl(220_16%_88%)] bg-white px-6 py-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] md:px-8 md:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">Retailer pricing</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-[hsl(222_47%_10%)] md:text-4xl">
            Manage products from your own suppliers
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[hsl(220_12%_32%)]">
            This pricing is separate because these products are not part of the EANrunner supplier network.
          </p>

          <div className="mt-7 rounded-2xl border border-[hsl(220_16%_88%)] bg-[hsl(220_22%_99%)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_42%)]">Products from your own suppliers</p>
            <p className="mt-4 text-[40px] font-black leading-none text-[hsl(221_92%_44%)]">€0,1</p>
            <p className="mt-1 text-base font-semibold text-[hsl(222_47%_16%)]">per updated product</p>
            <p className="mt-4 text-base font-semibold text-[hsl(222_47%_15%)]">Minimum €299/month</p>

            <ul className="mt-5 list-disc space-y-1.5 pl-5 text-sm leading-7 text-[hsl(220_12%_30%)]">
              <li>Hourly stock updates</li>
              <li>Price robot</li>
              <li>Supplier feed automation</li>
              <li>Product data handling</li>
              <li>Product enrichment where available</li>
              <li>Local product text where available</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={openGmailCompose}
            className="mt-7 inline-flex h-10 items-center rounded-lg bg-[hsl(221_92%_44%)] px-4 text-sm font-semibold text-white hover:bg-[hsl(221_92%_38%)]"
          >
            Talk to us about your suppliers
          </button>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
