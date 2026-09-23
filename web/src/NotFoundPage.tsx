import { Link } from 'react-router-dom';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function NotFoundPage() {
  useDocumentMeta({
    title: '404 Page Not Found',
    description: 'The requested EANrunner page could not be found. Browse the catalog or navigate to key company pages.',
  });

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[820px] px-4 py-20">
        <section className="rounded-2xl border border-[hsl(220_16%_88%)] bg-white px-6 py-12 text-center shadow-[0_10px_28px_rgb(18_32_74/0.08)] sm:px-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[hsl(221_72%_46%)]">404</p>
          <h1 className="mt-2 text-4xl font-bold leading-tight text-[hsl(222_47%_10%)]">Page not found</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[hsl(220_14%_34%)]">
            The page you were looking for doesn&rsquo;t exist or may have moved.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-lg border border-[hsl(221_72%_72%)] bg-[hsl(221_84%_95%)] px-5 text-sm font-semibold text-[hsl(221_72%_32%)] hover:brightness-95"
            >
              Back to catalog
            </Link>
            <Link
              to="/for-retailers"
              className="inline-flex h-11 items-center rounded-lg border border-[hsl(220_16%_84%)] bg-white px-5 text-sm font-semibold text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
            >
              For retailers
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-11 items-center rounded-lg border border-[hsl(220_16%_84%)] bg-white px-5 text-sm font-semibold text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
            >
              Contact us
            </Link>
          </div>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
