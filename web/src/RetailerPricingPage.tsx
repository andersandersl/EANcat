import { ArrowLeft, FileText, Image, Languages, RefreshCw, Sparkles, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

const includedFeatures = [
  { title: 'Hourly stock updates', Icon: RefreshCw },
  { title: 'Price robot', Icon: Tags },
  { title: 'Local product texts', Icon: Languages },
  { title: 'Product enrichment', Icon: Sparkles },
  { title: 'Product pictures', Icon: Image },
  { title: 'Supplier feed automation', Icon: FileText },
];

export default function RetailerPricingPage() {
  useDocumentMeta({
    title: 'Retailer Pricing: €0,1 per updated product',
    description: 'Retailer pricing from EANrunner with per-product update pricing, hourly stock updates, and price automation.',
    path: '/pricing/retailers',
  });

  const openGmailCompose = () => {
    const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('info@eanrunner.com')}&su=${encodeURIComponent('Start as retailer')}`;
    window.open(composeUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[hsl(220_18%_97%)] text-[hsl(222_47%_12%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[1000px] px-4 py-8 md:py-10">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pricing
        </Link>

        <section className="mt-6 px-1 py-2 md:px-0 md:py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">Retailer pricing</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-[hsl(222_47%_10%)] md:text-4xl">
            Pay per updated supplier product
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[hsl(220_12%_32%)]">
            Retailers pay €0,1 for each supplier-network product update.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[hsl(220_12%_32%)]">
            This keeps pricing simple and directly tied to update volume.
          </p>

          <div className="mt-8 border-t border-[hsl(220_16%_90%)] pt-6">
            <h2 className="text-2xl font-bold leading-tight text-[hsl(222_47%_10%)]">Products from our supplier network</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[34px] font-black leading-none text-[hsl(221_92%_44%)]">€0,1</p>
                <p className="mt-1 text-sm text-[hsl(220_12%_34%)]">per updated product</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Billing model</p>
                <p className="mt-1 text-base font-semibold text-[hsl(222_47%_15%)]">Charged for each supplier-network product update.</p>
              </div>
            </div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Included</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-7 text-[hsl(220_12%_30%)]">
              <li>Hourly stock updates</li>
              <li>Price robot</li>
              <li>Local ecommerce product texts where available</li>
              <li>Product enrichment where available</li>
              <li>Translation where available</li>
              <li>Supplier feed handling</li>
            </ul>

            <p className="mt-5 text-sm leading-7 text-[hsl(220_12%_32%)]">You only pay when products are updated.</p>
          </div>

          <button
            type="button"
            onClick={openGmailCompose}
            className="mt-7 inline-flex h-9 items-center rounded-md bg-[hsl(221_92%_44%)] px-[14px] text-sm font-semibold text-white hover:bg-[hsl(221_92%_38%)]"
          >
            Start as retailer
          </button>
        </section>

        <section className="mt-10 px-1 md:px-0">
          <h2 className="text-2xl font-bold leading-tight text-[hsl(222_47%_10%)]">What does product creation cost you today?</h2>
          <div className="mt-5 rounded-lg border border-[hsl(220_14%_89%)] bg-[hsl(221_95%_97%)] px-4 py-6 sm:px-6 sm:py-7 shadow-[0_1px_3px_0_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.04)]">
            <p className="text-[28px] font-black leading-tight text-[hsl(222_47%_10%)] sm:text-[42px]">
              10 minutes <span className="text-[hsl(221_92%_44%)]">x</span> 1,000 products <span className="text-[hsl(221_92%_44%)]">=</span> 167 hours
            </p>
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-[hsl(220_12%_34%)] sm:text-base">
            And that is before stock updates, price updates, translations, images, and product texts.
          </p>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-[hsl(220_12%_34%)] sm:text-base">
            With EANrunner, these workflows are handled in one managed product system.
          </p>
        </section>

        <section className="mt-10 px-1 md:px-0">
          <h2 className="text-2xl font-bold leading-tight text-[hsl(222_47%_10%)]">The price robot is included</h2>
          <p className="mt-2 text-sm leading-7 text-[hsl(220_12%_30%)]">EANrunner can update prices based on your rules.</p>

          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Example rules</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-7 text-[hsl(220_12%_30%)]">
            <li>Stay cheapest when your minimum margin is reached</li>
            <li>Never sell below cost price</li>
            <li>Keep a minimum margin, for example €5 or 10%</li>
            <li>Follow market price changes automatically</li>
            <li>Pause products where the margin becomes too low</li>
          </ul>

          <p className="mt-4 text-sm font-medium leading-7 text-[hsl(222_47%_16%)]">
            This means your products are not just uploaded. They are actively managed.
          </p>
        </section>

        <section className="mt-10 px-1 md:px-0">
          <h2 className="text-2xl font-bold leading-tight text-[hsl(222_47%_10%)]">Do you also have your own suppliers?</h2>
          <p className="mt-3 text-sm leading-7 text-[hsl(220_12%_32%)]">
            EANrunner can also manage products from suppliers you already work with.
          </p>
          <p className="mt-1 text-sm leading-7 text-[hsl(220_12%_32%)]">
            This is priced separately because these products are not part of the EANrunner supplier network.
          </p>
          <Link
            to="/pricing/retailers/own-suppliers"
            className="mt-4 inline-flex h-9 items-center rounded-md bg-white px-[14px] text-sm font-semibold text-[hsl(221_92%_40%)] ring-1 ring-[hsl(220_14%_89%)] hover:bg-[hsl(221_95%_97%)]"
          >
            Read about managing your own suppliers
          </Link>
        </section>

        <section className="mt-10 px-1 md:px-0">
          <h2 className="text-2xl font-bold leading-tight text-[hsl(222_47%_10%)]">Included where data is available</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {includedFeatures.map(({ title, Icon }) => (
              <div key={title} className="inline-flex items-center gap-3 text-sm text-[hsl(220_12%_30%)]">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(220_14%_89%)] bg-[hsl(220_22%_99%)] text-[hsl(221_92%_44%)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{title}</span>
              </div>
            ))}
          </div>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
