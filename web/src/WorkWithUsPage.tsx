import {
  BadgeCheck,
  Bot,
  Briefcase,
  Boxes,
  Database,
  Landmark,
  Mail,
  PlugZap,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function WorkWithUsPage() {
  useDocumentMeta({
    title: 'Partner with EANrunner',
    description:
      'Partner with EANrunner to connect retailers, distributors, and brands through structured product data, integrations, and automation across Europe.',
    path: '/work-with-us',
  });

  const partnerTypes = [
    {
      title: 'Retailers',
      icon: Store,
      who: 'Retailers looking for new products, brands, or suppliers.',
      what: 'We can help you expand your assortment with live product data, structured catalogs, and faster onboarding.',
    },
    {
      title: 'Distributors',
      icon: Boxes,
      who: 'Distributors that want to reach more retailers and enter new markets.',
      what: 'We can connect your catalog to EANrunner and make your assortment easier to discover and activate.',
    },
    {
      title: 'Brand owners',
      icon: BadgeCheck,
      who: 'Brands looking to expand into new countries, marketplaces, or retailer networks.',
      what: 'We can explore how EANrunner can help increase your reach and make your products easier to distribute.',
    },
    {
      title: 'Marketplace sellers',
      icon: ShoppingBag,
      who: 'Operators already selling on marketplaces such as Amazon, Bol, CDON, Kaufland, or Zalando.',
      what: 'We want to work with experienced marketplace partners who know how to scale products across channels and markets.',
    },
    {
      title: 'Product information partners',
      icon: Database,
      who: 'Partners with specifications, images, enrichment, translations, technical data, or catalog content.',
      what: 'High-quality product information is core to EANrunner, and we are especially interested in performance-based partnerships here.',
      highPriority: true,
    },
    {
      title: 'Logistics & fulfillment partners',
      icon: Truck,
      who: '3PL, warehousing, cross-docking, last-mile, returns, and fulfillment specialists.',
      what: 'As EANrunner grows, strong logistics partnerships become more important for scaling distribution in new markets.',
    },
    {
      title: 'Ecommerce platforms',
      icon: PlugZap,
      who: 'Commerce platforms such as Shopify, WooCommerce, Quickbutik, Magento, Prestashop, and Shopware.',
      what: 'We are interested in integrations and partnerships that help retailers launch products faster and more reliably.',
    },
    {
      title: 'AI & technology partners',
      icon: Bot,
      who: 'Teams building automation, enrichment, catalog, pricing, translation, or ecommerce operations tooling.',
      what: 'AI is a core part of how we operate, and we would like to talk to technology partners that can help us move faster.',
    },
    {
      title: 'Investors',
      icon: Landmark,
      who: 'Investors who understand marketplaces, product data, automation, or ecommerce infrastructure.',
      what: 'EANrunner is currently 100% bootstrapped. We have strong momentum and expect to raise a seed round with investors who can bring both capital and relevant expertise.',
    },
    {
      title: 'Freelancers & consultants',
      icon: Briefcase,
      who: 'Independent specialists in ecommerce, onboarding, logistics, AI, business development, or retailer relationships.',
      what: 'If you can help us execute faster and create real commercial value, we would be happy to talk.',
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(220_18%_97%)] text-[hsl(222_47%_8%)]">
      <PageTopBar />
      <main className="mx-auto w-full max-w-[1180px] px-4 py-8">
        <header className="overflow-hidden rounded-3xl border border-[hsl(220_16%_88%)] bg-white shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden bg-[linear-gradient(180deg,#102055_0%,#162766_50%,#17224f_100%)] px-6 py-8 text-white md:px-8 md:py-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: [
                    'radial-gradient(95% 80% at 22% 0%, rgba(53,103,255,0.34) 0%, rgba(53,103,255,0) 62%)',
                    'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
                  ].join(','),
                }}
              />
              <div className="pointer-events-none absolute inset-y-0 right-[-8%] hidden w-[52%] lg:block" aria-hidden="true">
                <div className="absolute right-0 top-[23%] h-16 w-full rounded-l-[22px] bg-[linear-gradient(90deg,rgba(142,170,255,0.12),rgba(142,170,255,0.42),rgba(142,170,255,0.12))]" />
                <div className="absolute right-0 top-[49%] h-16 w-[92%] rounded-l-[22px] bg-[linear-gradient(90deg,rgba(142,170,255,0.12),rgba(142,170,255,0.42),rgba(142,170,255,0.12))]" />
                <div className="absolute right-0 top-[75%] h-16 w-[78%] rounded-l-[22px] bg-[linear-gradient(90deg,rgba(142,170,255,0.1),rgba(142,170,255,0.34),rgba(142,170,255,0.1))]" />
              </div>

              <div className="relative z-10 max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b4c7ff]">Partnerships</p>
                <h1 className="mt-4 text-3xl font-bold leading-[1.02] text-white md:text-5xl">Small team. Big network.</h1>
                <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/82">
                  We believe in the one-person unicorn idea. In our case, it&apos;s a two-person version. Technology allows us to stay lean, but growth comes from great partnerships. Here&apos;s who we&apos;re looking to build with.
                </p>
              </div>
            </div>

            <div className="bg-[linear-gradient(180deg,hsl(220_24%_99%)_0%,hsl(220_20%_97%)_100%)] px-6 py-8 md:px-8 md:py-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_46%)]">Why partnerships matter</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[hsl(220_14%_34%)]">
                <p>We do not want to build a large organization. We want to build an effective one.</p>
                <p>That means aligned incentives, strong operators around us, and partnerships that actually create leverage.</p>
                <p>Performance-based partnerships are usually more interesting to us than traditional fixed-cost arrangements.</p>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a
                  href="mailto:info@eanrunner.com?subject=EANrunner%20Partnership%20Inquiry"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(221_92%_55%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.75)] hover:brightness-95 sm:w-auto"
                >
                  <Mail className="h-4 w-4" />
                  Contact us
                </a>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-xl border border-[hsl(220_16%_84%)] bg-[hsl(220_18%_98%)] px-4 py-2 text-sm font-semibold text-[hsl(222_47%_18%)] hover:bg-white sm:w-auto"
                >
                  Back to catalog
                </Link>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_46%)]">We are activly looking for partners in these areas</h2>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[hsl(220_16%_88%)] bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.22)]">
            <div className="hidden md:grid md:grid-cols-[1.15fr_1fr_1.3fr] md:px-6 md:py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Role</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Who is it for</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">What we can do together</p>
            </div>

            <div>
              {partnerTypes.map((item) => (
                <article
                  key={item.title}
                  className="border-t border-[hsl(220_16%_92%)] px-5 py-5 first:border-t-0 sm:px-6"
                >
                  <div className="grid gap-4 md:grid-cols-[1.15fr_1fr_1.3fr] md:gap-6">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,hsl(221_84%_95%)_0%,hsl(220_70%_97%)_100%)] text-[hsl(221_72%_38%)] shadow-[inset_0_0_0_1px_rgba(26,94,255,0.08)]">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <h3 className="text-[18px] font-semibold leading-tight text-[hsl(222_47%_12%)]">{item.title}</h3>
                          {item.highPriority ? (
                            <span className="inline-flex w-fit items-center rounded-full border border-[hsl(221_72%_78%)] bg-[hsl(221_84%_95%)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(221_72%_32%)]">
                              High priority
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)] md:hidden">Who is it for</p>
                      <p className="text-sm leading-6 text-[hsl(220_14%_34%)]">{item.who}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)] md:hidden">What we can do together</p>
                      <p className="text-sm leading-6 text-[hsl(220_14%_34%)]">{item.what}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-[hsl(220_16%_88%)] bg-white px-6 py-6 text-sm text-[hsl(220_14%_34%)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[hsl(222_47%_12%)]">Contact</p>
              <p className="mt-1 max-w-2xl">Performance-based partnerships preferred.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:info@eanrunner.com?subject=EANrunner%20Partnership%20Inquiry"
                className="inline-flex items-center rounded-xl bg-[hsl(221_92%_55%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.75)] hover:brightness-95"
              >
                info@eanrunner.com
              </a>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
