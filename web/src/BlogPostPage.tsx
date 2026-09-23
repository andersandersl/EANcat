import { Link, useParams } from 'react-router-dom';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { getBlogPostBySlug } from './blogPosts';
import { useDocumentMeta } from './useDocumentMeta';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;

  useDocumentMeta({
    title: post ? post.title : 'Blog Post',
    description: post ? post.summary : 'Read the latest EANrunner news, launches, and ecommerce insights.',
    path: post ? `/blog/${post.slug}` : '/blog',
  });

  if (!post) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] text-[hsl(222_47%_10%)]">
        <PageTopBar />
        <main className="mx-auto w-full max-w-[1760px] px-4 py-10">
          <section className="rounded-xl border border-[hsl(220_16%_88%)] bg-white p-6">
            <h1 className="text-2xl font-bold">Post not found</h1>
            <p className="mt-2 text-[14px] text-[hsl(220_14%_34%)]">The post link may be outdated or removed.</p>
            <Link
              to="/blog"
              className="mt-4 inline-flex items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[hsl(222_47%_18%)] hover:bg-[hsl(220_18%_95%)]"
            >
              Back to blog
            </Link>
          </section>
          <SiteFooter className="mt-10" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[1760px] px-4 py-8">
        <article className="rounded-2xl border border-[hsl(220_16%_88%)] bg-white p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_44%)]">{post.date}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-[15px] leading-7 text-[hsl(220_14%_30%)]">{post.summary}</p>

          {post.content.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-[15px] leading-7 text-[hsl(220_14%_30%)]">{paragraph}</p>
          ))}

          {post.quote ? (
            <figure className="mt-5 rounded-lg border border-[hsl(220_16%_88%)] bg-[hsl(220_20%_98%)] px-4 py-3">
              <blockquote className="text-[15px] font-medium italic leading-7 text-[hsl(222_47%_16%)]">“{post.quote}”</blockquote>
              {post.quoteBy ? (
                <figcaption className="mt-1 text-[12px] text-[hsl(220_12%_46%)]">{post.quoteBy}</figcaption>
              ) : null}
            </figure>
          ) : null}

          {post.images && post.images.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {post.images.map((image) => (
                <div key={image.src} className="overflow-hidden rounded-lg border border-[hsl(220_14%_90%)] bg-[hsl(220_20%_98%)]">
                  <img src={image.src} alt={image.alt} className="h-64 w-full object-contain" loading="lazy" />
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              to="/blog"
              className="inline-flex items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[hsl(222_47%_18%)] hover:bg-[hsl(220_18%_95%)]"
            >
              Back to blog
            </Link>
            <span className="text-[12px] text-[hsl(220_12%_46%)]">Link path: /blog/{post.slug}</span>
          </div>
        </article>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
