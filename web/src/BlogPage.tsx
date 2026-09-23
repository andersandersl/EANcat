import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { getSortedBlogPosts } from './blogPosts';
import { useDocumentMeta } from './useDocumentMeta';

export default function BlogPage() {
  useDocumentMeta({
    title: 'EANrunner Blog',
    description:
      'Read EANrunner updates, product launches, and practical insights on structured product data and cross-border ecommerce operations.',
    path: '/blog',
  });

  const sortedFeedItems = getSortedBlogPosts();

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[1760px] px-4 py-8">
        <section className="relative overflow-hidden rounded-2xl border border-[hsl(220_16%_88%)] bg-[linear-gradient(135deg,hsl(225_78%_18%)_0%,hsl(228_74%_16%)_45%,hsl(214_72%_28%)_100%)] p-6 text-white sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(90% 70% at 88% 0%, rgba(133,170,255,0.26) 0%, rgba(133,170,255,0) 70%), repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, rgba(255,255,255,0) 1px 28px)',
            }}
          />
          <div className="relative z-10 max-w-[760px]">
            <p className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#d7e4ff]">
              EANrunner blog and updates
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-[52px]">News, launches, and real progress</h1>
            <p className="mt-4 max-w-[65ch] text-[15px] leading-relaxed text-white/88">
              Product updates, milestones, and event highlights from the EANrunner team. Follow the latest changes and open each item on LinkedIn for the full context.
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[hsl(221_92%_42%)]" />
              <h2 className="text-[22px] font-bold leading-tight">Updates</h2>
            </div>

            <div className="space-y-3">
              {sortedFeedItems.map((item) => (
                <article key={`${item.date}-${item.title}`} className="rounded-xl border border-[hsl(220_14%_90%)] bg-[hsl(220_20%_98%)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_44%)]">{item.date}</p>
                  <p className="mt-1 text-[15px] font-semibold text-[hsl(222_47%_12%)]">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-6 text-[hsl(220_14%_34%)]">{item.summary}</p>
                  {item.content.map((paragraph) => (
                    <p key={paragraph} className="mt-2 text-[13px] leading-6 text-[hsl(220_14%_34%)]">{paragraph}</p>
                  ))}
                  {item.quote ? (
                    <figure className="mt-3 rounded-lg border border-[hsl(220_16%_88%)] bg-white px-3 py-2.5">
                      <blockquote className="text-[13px] font-medium italic leading-6 text-[hsl(222_47%_16%)]">“{item.quote}”</blockquote>
                      {item.quoteBy ? (
                        <figcaption className="mt-1 text-[11px] text-[hsl(220_12%_46%)]">{item.quoteBy}</figcaption>
                      ) : null}
                    </figure>
                  ) : null}
                  {item.images && item.images.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {item.images.map((image) => (
                        <div key={image.src} className="overflow-hidden rounded-lg border border-[hsl(220_14%_90%)] bg-white">
                          <img src={image.src} alt={image.alt} className="h-40 w-full object-contain" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Link
                    to={`/blog/${item.slug}`}
                    className="mt-3 inline-flex items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1 text-[12px] font-semibold text-[hsl(221_92%_42%)] hover:bg-[hsl(220_18%_95%)]"
                  >
                    Open post page
                  </Link>
                </article>
              ))}
            </div>
          </article>

          <aside className="rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#0A66C2] text-[8px] font-bold text-white">in</span>
              <h2 className="text-[20px] font-bold">Status and events</h2>
            </div>
            <p className="text-[14px] leading-6 text-[hsl(220_14%_34%)]">
              Quick status feed style updates you can continuously post and link from LinkedIn.
            </p>
            <div className="mt-4 space-y-2 text-[13px] leading-6 text-[hsl(220_14%_30%)]">
              <p>• We welcomed a new retailer partner onboard this month.</p>
              <p>• Today we are live with our new website.</p>
              <p>• We joined our bank event to discuss scaling in Nordic ecommerce.</p>
              <p>• We attended a Microsoft event and collected ideas for AI-powered workflows.</p>
            </div>
            <a
              href="https://www.linkedin.com/company/eanrunner"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-[hsl(220_16%_84%)] bg-[hsl(220_20%_98%)] px-3 py-1.5 text-[12px] font-semibold text-[hsl(222_47%_18%)] hover:bg-[hsl(220_18%_95%)]"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#0A66C2] text-[8px] font-bold text-white">in</span>
              Follow EANrunner on LinkedIn
            </a>
          </aside>
        </section>

        <div className="mt-6 flex justify-end">
          <Link
            to="/"
            className="inline-flex items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[hsl(222_47%_18%)] hover:bg-[hsl(220_18%_95%)]"
          >
            Back to catalog
          </Link>
        </div>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
