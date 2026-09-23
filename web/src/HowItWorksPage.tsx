import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

const STEPS = [
  {
    title: '1. Connect catalog sources',
    text: 'We ingest supplier product feeds and normalize structure, naming, and key attributes.',
  },
  {
    title: '2. Enrich and standardize',
    text: 'Product data is cleaned, translated, categorized, and prepared for market-ready ecommerce usage.',
  },
  {
    title: '3. Sync to retail channels',
    text: 'Retailers receive structured products through integrations and can publish faster with less manual work.',
  },
  {
    title: '4. Automate ongoing updates',
    text: 'Price, stock, and content updates are handled continuously so catalogs stay current over time.',
  },
];

export default function HowItWorksPage() {
  useDocumentMeta({
    title: 'How EANrunner Works',
    description:
      'See how EANrunner turns supplier data into live retail catalogs with product enrichment, integrations, and automated stock and price syncing.',
    path: '/how-it-works',
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(210_40%_98%),hsl(220_22%_96%))] text-[hsl(222_47%_12%)]">
      <PageTopBar />

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>

        <section className="mt-6 rounded-3xl border border-[hsl(220_16%_88%)] bg-white px-6 py-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] md:px-8 md:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">How it works</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-[hsl(222_47%_10%)] md:text-4xl">
            From supplier files to live retail catalogs
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[hsl(220_12%_32%)]">
            EANrunner removes the technical bottlenecks between distributors and retailers by turning fragmented product data into a structured, automated flow.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-6 shadow-sm md:p-7">
          <div className="grid gap-3 md:grid-cols-2">
            {STEPS.map((step) => (
              <article key={step.title} className="rounded-xl border border-[hsl(220_14%_90%)] bg-[hsl(220_20%_98%)] p-4">
                <h2 className="text-base font-semibold text-[hsl(222_47%_12%)]">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[hsl(220_12%_34%)]">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}