import { Link } from 'react-router-dom';
import { Mail, Building2 } from 'lucide-react';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function ContactPage() {
  useDocumentMeta({
    title: 'Contact EANrunner',
    description:
      'Contact EANrunner for retailer onboarding, distributor partnerships, pricing questions, or product catalog support.',
    path: '/contact',
  });

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[980px] px-4 py-10">
        <section className="rounded-2xl border border-[hsl(220_16%_88%)] bg-[linear-gradient(180deg,hsl(220_24%_99%),hsl(220_20%_97%))] px-6 py-8 shadow-[0_10px_28px_rgb(18_32_74/0.08)] sm:px-8">
          <h1 className="text-4xl font-bold leading-tight text-[hsl(222_47%_10%)]">Contact us</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[hsl(220_14%_34%)]">
            Questions about EANrunner, suppliers, or getting your shop connected? We&rsquo;re a small team and we read
            every message.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <a
              href="mailto:info@eanrunner.com"
              className="flex items-start gap-3 rounded-xl border border-[hsl(220_16%_86%)] bg-white px-4 py-4 hover:bg-[hsl(220_18%_98%)]"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[hsl(220_16%_86%)] bg-white text-[hsl(221_72%_38%)]">
                <Mail className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Email</span>
                <span className="block text-[15px] font-medium text-[hsl(221_92%_42%)]">info@eanrunner.com</span>
              </span>
            </a>

            <a
              href="https://www.linkedin.com/company/eanrunner"
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-3 rounded-xl border border-[hsl(220_16%_86%)] bg-white px-4 py-4 hover:bg-[hsl(220_18%_98%)]"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[hsl(220_16%_86%)] bg-white">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#0A66C2] text-[8px] font-bold text-white">in</span>
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Follow</span>
                <span className="block text-[15px] font-medium text-[hsl(222_47%_18%)]">LinkedIn</span>
              </span>
            </a>

            <div className="flex items-start gap-3 rounded-xl border border-[hsl(220_16%_86%)] bg-white px-4 py-4 sm:col-span-2">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[hsl(220_16%_86%)] bg-white text-[hsl(220_12%_40%)]">
                <Building2 className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Company</span>
                <span className="block text-[15px] font-medium text-[hsl(222_47%_18%)]">EANrunner by Etaility AB</span>
                <span className="block text-[13px] text-[hsl(220_14%_38%)]">VAT SE559006389601</span>
              </span>
            </div>
          </div>

          <div className="mt-7 rounded-xl border border-[hsl(221_35%_88%)] bg-[hsl(221_60%_97%)] px-5 py-5">
            <h2 className="text-[17px] font-bold text-[hsl(222_47%_14%)]">Want to start selling more products?</h2>
            <p className="mt-1.5 text-[14px] text-[hsl(220_14%_34%)]">
              Request access and we&rsquo;ll help you get set up with the right suppliers for your market.
            </p>
            <Link
              to="/get-approved"
              className="mt-3 inline-flex h-11 items-center rounded-lg border border-[hsl(221_72%_72%)] bg-[hsl(221_84%_95%)] px-5 text-sm font-semibold text-[hsl(221_72%_32%)] hover:brightness-95"
            >
              Get approved
            </Link>
          </div>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
