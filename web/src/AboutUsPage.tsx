import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { getSortedBlogPosts } from './blogPosts';
import { useDocumentMeta } from './useDocumentMeta';

export default function AboutUsPage() {
  useDocumentMeta({
    title: 'About EANrunner',
    description:
      'Learn about EANrunner, the team helping distributors, brands, and retailers scale cross-border ecommerce with structured product data and automation.',
    path: '/about-us',
  });

  const latestPosts = getSortedBlogPosts().slice(0, 4);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(210_40%_98%),hsl(220_22%_96%))] text-[hsl(222_47%_12%)]">
      <PageTopBar />
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to catalog
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-[hsl(220_16%_88%)] bg-white px-6 py-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] md:px-8 md:py-10">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-[hsl(222_47%_10%)] md:text-4xl">
            About Us
          </h1>
          <div className="mt-4 max-w-3xl space-y-4 text-base leading-7 text-[hsl(220_12%_32%)]">
            <p>
              EANrunner was founded by Jacob and Anders after years in eCommerce, distribution, and product data.
            </p>
            <p>
              We saw the same challenge repeatedly: distributors and retailers wanted to work together, but products often never made it online because the systems behind them didn't connect.
            </p>
            <p>
              EANrunner helps brands, distributors, and retailers connect through product data, automation, and AI.
            </p>
            <p>Amazon famously started in a garage.</p>
            <p>We already have two.</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-4 shadow-sm md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="overflow-hidden rounded-xl border border-[hsl(220_16%_88%)] bg-[hsl(220_18%_98%)]">
              <img
                src="/about/jacob-hq-black.jpg"
                alt="Jacob's HQ"
                className="h-64 w-full object-cover md:h-72"
                loading="lazy"
              />
              <figcaption className="px-4 py-3">
                <p className="text-sm font-semibold text-[hsl(222_47%_12%)]">Jacob's garage</p>
                <a href="mailto:jacob@eanrunner.com" className="text-xs text-[hsl(221_92%_45%)] hover:underline">jacob@eanrunner.com</a>
                <p>
                  <a
                    href="https://www.linkedin.com/in/jacob-marup-lorentzen/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[hsl(221_92%_45%)] hover:underline"
                  >
                    LinkedIn
                  </a>
                </p>
              </figcaption>
            </figure>

            <figure className="overflow-hidden rounded-xl border border-[hsl(220_16%_88%)] bg-[hsl(220_18%_98%)]">
              <img
                src="/about/anders-garage-white.jpg"
                alt="Anders' garage"
                className="h-64 w-full object-cover md:h-72"
                loading="lazy"
              />
              <figcaption className="px-4 py-3">
                <p className="text-sm font-semibold text-[hsl(222_47%_12%)]">Anders' garage</p>
                <a href="mailto:anders@eanrunner.com" className="text-xs text-[hsl(221_92%_45%)] hover:underline">anders@eanrunner.com</a>
                <p>
                  <a
                    href="https://www.linkedin.com/in/anderslorenzenandersen/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[hsl(221_92%_45%)] hover:underline"
                  >
                    LinkedIn
                  </a>
                </p>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-6 shadow-sm md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(220_12%_46%)]">News and updates</p>
              <h2 className="mt-2 text-2xl font-bold text-[hsl(222_47%_12%)]">From our blog</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {latestPosts.map((post) => (
              <article key={post.slug} className="rounded-xl border border-[hsl(220_16%_88%)] bg-[hsl(220_18%_98%)] p-4">
                <p className="text-[11px] font-medium text-[hsl(220_12%_45%)]">{post.date}</p>
                <h3 className="mt-1 text-base font-semibold text-[hsl(222_47%_12%)]">{post.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[hsl(220_12%_34%)]">{post.summary}</p>
                <Link
                  to={`/blog/${post.slug}`}
                  className="mt-3 inline-flex items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1 text-[12px] font-semibold text-[hsl(221_92%_42%)] hover:bg-[hsl(220_18%_95%)]"
                >
                  Read full post
                </Link>
              </article>
            ))}
          </div>
        </section>

        <SiteFooter className="mt-10" />
      </div>
    </div>
  );
}
