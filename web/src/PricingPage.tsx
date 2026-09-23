import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function PricingPage() {
  useDocumentMeta({
    title: 'Pricing',
    description: 'See EANrunner pricing for distributors and retailers, including commission-based models and catalog activation costs.',
    path: '/pricing',
  });

  return (
    <div className="min-h-screen bg-[hsl(220_18%_97%)] text-[hsl(222_47%_12%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[1180px] px-4 py-8 md:py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>

        <section className="mt-6 rounded-lg border border-[hsl(220_14%_89%)] bg-white px-6 py-8 shadow-[0_1px_3px_0_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.04)] md:px-8 md:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">Pricing</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-[hsl(222_47%_10%)] md:text-4xl">Pricing</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[hsl(220_12%_32%)]">
            Simple pricing for distributors and retailers.
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <article className="flex h-full flex-col rounded-lg border border-[hsl(220_14%_89%)] bg-[hsl(220_20%_98%)] p-6 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_42%)]">For distributors</p>
              <p className="mt-3 text-[40px] font-black leading-none text-[hsl(221_92%_44%)]">2% commission</p>
              <p className="mt-4 text-sm text-[hsl(220_12%_34%)]">Pay only when we create sales.</p>
              <ul className="mt-4 space-y-1.5 text-sm leading-7 text-[hsl(220_12%_30%)]">
                <li>• No sales - no commission</li>
                <li>• Retailer channel access through one connection</li>
                <li>• Product data, stock, and feed handling included</li>
              </ul>
              <div className="mt-auto pt-4">
                <Link
                  to="/pricing/distributors"
                  className="inline-flex h-9 items-center rounded-md bg-[hsl(221_92%_44%)] px-[14px] text-sm font-semibold text-white hover:bg-[hsl(221_92%_38%)]"
                >
                  Read more
                </Link>
              </div>
            </article>

            <article className="flex h-full flex-col rounded-lg border border-[hsl(220_14%_89%)] bg-[hsl(220_20%_98%)] p-6 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_42%)]">For retailers</p>
              <p className="mt-3 text-[40px] font-black leading-none text-[hsl(221_92%_44%)]">€0,1</p>
              <p className="mt-4 text-sm text-[hsl(220_12%_28%)]">Supplier-network products cost €0,1 per updated product for retailers.</p>
              <ul className="mt-4 space-y-1.5 text-sm leading-7 text-[hsl(220_12%_30%)]">
                <li>• Supplier pays when sales are created</li>
                <li>• Price robot included</li>
                <li>• Hourly stock updates included</li>
              </ul>
              <div className="mt-auto pt-4">
                <Link
                  to="/pricing/retailers"
                  className="inline-flex h-9 items-center rounded-md bg-[hsl(221_92%_44%)] px-[14px] text-sm font-semibold text-white hover:bg-[hsl(221_92%_38%)]"
                >
                  Read more
                </Link>
              </div>
            </article>
          </div>

          <p className="mt-3 text-[12px] leading-5 text-[hsl(220_12%_40%)] lg:text-right">Fair use applies for very large catalogues.</p>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
