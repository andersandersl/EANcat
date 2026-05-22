import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Network, PlugZap, ShieldCheck } from 'lucide-react';

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(210_40%_98%),hsl(220_22%_96%))] text-[hsl(222_47%_12%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to catalog
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-[hsl(220_16%_88%)] bg-white shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_0.85fr]">
            <div className="px-6 py-8 md:px-8 md:py-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(221_72%_42%)]">About EANrunner</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-[hsl(222_47%_10%)] md:text-4xl">
                EANrunner turns messy supplier data into fast retailer onboarding.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[hsl(220_12%_32%)]">
                All distribution companies have unique and fragmented product data structures. This creates major integration challenges for retailers and slows down onboarding. For commercial leaders this becomes a growth bottleneck, where expansion gets stuck in IT projects instead of sales. EANrunner unifies and structures product data, making retailer integrations fast and scalable.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5 text-sm">
                <span className="rounded-full bg-[hsl(221_84%_95%)] px-3 py-1.5 font-medium text-[hsl(221_72%_32%)]">Structured product data</span>
                <span className="rounded-full bg-[hsl(160_44%_94%)] px-3 py-1.5 font-medium text-[hsl(160_42%_28%)]">Faster retailer integrations</span>
                <span className="rounded-full bg-[hsl(35_100%_95%)] px-3 py-1.5 font-medium text-[hsl(28_78%_32%)]">Scalable supplier onboarding</span>
              </div>
            </div>

            <div className="border-t border-[hsl(220_16%_90%)] bg-[linear-gradient(180deg,hsl(220_24%_98%),hsl(220_20%_96%))] px-6 py-8 md:px-8 lg:border-l lg:border-t-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">Company information</p>
              <div className="mt-5 space-y-4 text-sm text-[hsl(220_12%_28%)]">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-[hsl(221_92%_55%)]" />
                  <div>
                    <p className="font-semibold text-[hsl(222_47%_12%)]">EANrunner</p>
                    <p>A part of Etaility AB</p>
                    <p>Org. number: 559006-3896</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-[hsl(221_92%_55%)]" />
                  <div>
                    <p className="font-semibold text-[hsl(222_47%_12%)]">Contact</p>
                    <a href="mailto:info@eanrunner.com" className="text-[hsl(221_92%_45%)] hover:underline">info@eanrunner.com</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">Why this matters</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-[hsl(220_20%_97%)] p-4">
                <Network className="h-5 w-5 text-[hsl(221_92%_55%)]" />
                <h2 className="mt-3 text-sm font-semibold text-[hsl(222_47%_12%)]">Fragmented inputs</h2>
                <p className="mt-1 text-sm leading-6 text-[hsl(220_12%_34%)]">
                  Suppliers all send product data in different formats, depths, and quality levels.
                </p>
              </div>
              <div className="rounded-xl bg-[hsl(220_20%_97%)] p-4">
                <PlugZap className="h-5 w-5 text-[hsl(221_92%_55%)]" />
                <h2 className="mt-3 text-sm font-semibold text-[hsl(222_47%_12%)]">Slow onboarding</h2>
                <p className="mt-1 text-sm leading-6 text-[hsl(220_12%_34%)]">
                  Retailer expansion gets delayed because every new distributor becomes an integration project.
                </p>
              </div>
              <div className="rounded-xl bg-[hsl(220_20%_97%)] p-4">
                <ShieldCheck className="h-5 w-5 text-[hsl(221_92%_55%)]" />
                <h2 className="mt-3 text-sm font-semibold text-[hsl(222_47%_12%)]">Structured output</h2>
                <p className="mt-1 text-sm leading-6 text-[hsl(220_12%_34%)]">
                  EANrunner standardizes the data layer so commercial teams can move faster with less friction.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">What EANrunner does</p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-[hsl(220_12%_32%)]">
              <div>
                <h2 className="font-semibold text-[hsl(222_47%_12%)]">For retailers</h2>
                <p className="mt-1">Access structured supplier catalogs, compare opportunities, and move products into your store faster.</p>
              </div>
              <div>
                <h2 className="font-semibold text-[hsl(222_47%_12%)]">For distributors</h2>
                <p className="mt-1">Reduce onboarding friction and make it easier for more retailers to work with your assortment.</p>
              </div>
              <div>
                <h2 className="font-semibold text-[hsl(222_47%_12%)]">For commercial teams</h2>
                <p className="mt-1">Spend less time untangling feeds and more time growing accounts, shelf space, and product reach.</p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-[hsl(220_16%_88%)] bg-[linear-gradient(135deg,hsl(221_86%_97%),hsl(0_0%_100%))] p-6 shadow-sm md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">Built for commerce operators</p>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[hsl(220_12%_30%)]">
            EANrunner is designed for companies that want expansion to feel operational, not technical. The goal is simple: make supplier data usable, make integrations repeatable, and remove the manual bottlenecks that slow down growth.
          </p>
        </section>
      </div>
    </div>
  );
}
