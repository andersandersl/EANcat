import { useEffect, useState } from 'react';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { getCatalogStats } from './api';
import { useDocumentMeta } from './useDocumentMeta';

const LOGOS = [
  { kind: 'image' as const, src: '/marketing/logos/magento.png', alt: 'Magento logo' },
  { kind: 'image' as const, src: '/marketing/logos/shopify.png', alt: 'Shopify logo' },
  { kind: 'image' as const, src: '/marketing/logos/woocommerce.png', alt: 'WooCommerce logo' },
  { kind: 'iconText' as const, src: '/marketing/logos/quickbutik.svg', alt: 'Quickbutik logo', label: 'Quickbutik' },
  { kind: 'iconText' as const, src: 'https://cdn.simpleicons.org/googlebigquery/669DF6', alt: 'BigQuery logo', label: 'BigQuery' },
];

const MATCH_IMAGES = [
  '/marketing/product-1.png',
  '/marketing/product-2.png',
  '/marketing/product-3.png',
];

export default function ForRetailersPage() {
  useDocumentMeta({
    title: 'For Retailers: Source and Sync Products',
    description:
      'Expand your assortment with 100,000+ wholesale products, live stock feeds, and automated pricing workflows built for European retailers.',
    path: '/for-retailers',
  });

  const [inStockProducts, setInStockProducts] = useState<number | null>(null);
  const [integratedSuppliers, setIntegratedSuppliers] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    getCatalogStats()
      .then((stats) => {
        if (!active) return;
        setInStockProducts(stats.inStockProducts);
        setIntegratedSuppliers(stats.integratedSuppliers);
      })
      .catch(() => {
        if (!active) return;
        setInStockProducts(0);
        setIntegratedSuppliers(0);
      });

    return () => {
      active = false;
    };
  }, []);

  const suppliersLabel = Math.min(integratedSuppliers ?? 8, 8).toLocaleString('da-DK');
  const productsInStockLabel = inStockProducts == null ? '...' : inStockProducts.toLocaleString('da-DK');

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[1180px] px-4 py-8">
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h1 className="text-4xl font-bold leading-[1.04] sm:text-[52px]">
              <span className="text-[hsl(221_92%_50%)]">Expand your shop</span>
              <br />
              &amp; sell more products
            </h1>
            <ul className="mt-6 space-y-2.5 text-[16px] leading-relaxed text-[hsl(220_14%_30%)]">
              <li>✓ Access 100.000+ dropshipping &amp; cross-docking products</li>
              <li>✓ Discover the products with the highest margins</li>
              <li>✓ Push products live in minutes through integrations</li>
            </ul>
            <p className="mt-6 max-w-[56ch] rounded-md border border-[hsl(220_16%_84%)] bg-white px-4 py-3 text-sm font-medium text-[hsl(220_14%_28%)]">
              Want access? Contact us at{' '}
              <a href="mailto:info@eanrunner.com" className="font-semibold text-[hsl(221_92%_42%)] hover:underline">
                info@eanrunner.com
              </a>
              {' '}and we will help you get started.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[hsl(220_16%_88%)] bg-white p-3">
            <img
              src="/marketing/shop-hero.png"
              alt="EANrunner shop hero"
              className="w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <div className="h-8" />

        <section className="rounded-2xl border border-[hsl(220_16%_88%)] bg-[hsl(220_24%_98%)] px-4 py-5 sm:px-6">
          <div className="grid grid-cols-2 items-center gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {LOGOS.map((logo) => (
              <div key={logo.kind === 'image' ? logo.alt : logo.label} className="flex h-12 items-center justify-center">
                {logo.kind === 'image' && (
                  <img src={logo.src} alt={logo.alt} className="max-h-8 w-auto object-contain opacity-90" />
                )}
                {logo.kind === 'iconText' && (
                  <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-[hsl(222_47%_20%)] sm:text-[17px]">
                    <img src={logo.src} alt={logo.alt} className="h-5 w-5" />
                    {logo.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="h-24" />

        <section className="text-center">
          <h2 className="text-3xl font-bold leading-tight sm:text-[38px]">
            Grow your store with dropshipping and
            <br className="hidden sm:block" />
            cross-docking products, easily
          </h2>
        </section>

        <div className="h-16" />

        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h2 className="text-[32px] font-bold leading-tight">1. Select suppliers</h2>
            <p className="mt-3 text-[16px] text-[hsl(220_14%_34%)]">
              Serve more products to your customers with hand-picked suppliers.
            </p>
            <ul className="mt-4 space-y-2 text-[15px] text-[hsl(220_14%_30%)]">
              <li>✓ Choose from {suppliersLabel} pre-vetted suppliers across Europe</li>
              <li>✓ Easily enter into direct agreements</li>
              <li>✓ Everything is digitalized and can be managed in one place</li>
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <img
              src="/marketing/shop-1.png"
              alt="Supplier selection"
              className="h-full min-h-[290px] w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <div className="h-24" />

        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-[32px] font-bold leading-tight">2. Find high-margin products</h2>
            <p className="mt-3 text-[16px] text-[hsl(220_14%_34%)]">
              Use local price data compared with attractive wholesale prices and powerful filters, to find high-margin products in your market.
            </p>
            <ul className="mt-4 space-y-2 text-[15px] text-[hsl(220_14%_30%)]">
              <li>✓ Access 100.000+ products</li>
              <li>✓ Find unique attractive opportunities</li>
              <li>✓ Filter based on price data, local data and more</li>
            </ul>
          </div>
          <div>
            <img
              src="/marketing/shop-2.png"
              alt="High-margin products"
              className="h-full min-h-[290px] w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <div className="h-24" />

        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h2 className="text-[32px] font-bold leading-tight">3. Push products live in minutes</h2>
            <p className="mt-3 text-[16px] text-[hsl(220_14%_34%)]">
              With the click of a button, you can push products live to your shop.
            </p>
            <ul className="mt-4 space-y-2 text-[15px] text-[hsl(220_14%_30%)]">
              <li>✓ Connect your shop with our API or integrations</li>
              <li>✓ Push products and data into your shop with a click</li>
              <li>✓ Daily stock and pricing sync</li>
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <img
              src="/marketing/shop-3.png"
              alt="Push live"
              className="h-full min-h-[290px] w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <div className="h-28" />

        <section className="text-center">
          <h2 className="text-3xl font-bold sm:text-[38px]">Match examples</h2>
        </section>

        <div className="h-12" />

        <section className="grid gap-4 md:grid-cols-3">
          {MATCH_IMAGES.map((src, idx) => (
            <div key={src} className="overflow-hidden rounded-xl border border-[hsl(220_16%_88%)] bg-white p-2.5">
              <img src={src} alt={`Match example ${idx + 1}`} className="w-full rounded-lg object-cover" />
            </div>
          ))}
        </section>

        <div className="h-28" />

        <section className="rounded-2xl border border-[hsl(221_35%_88%)] bg-[hsl(221_60%_97%)] px-6 py-8 sm:px-8">
          <h2 className="text-center text-3xl font-bold sm:text-[38px]">Structured commerce at scale</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[hsl(220_16%_86%)] bg-white px-4 py-5 text-center">
              <p className="text-3xl font-bold text-[hsl(221_92%_45%)]">{suppliersLabel}</p>
              <p className="mt-1 text-sm text-[hsl(220_12%_38%)]">Integrated suppliers</p>
            </div>
            <div className="rounded-xl border border-[hsl(220_16%_86%)] bg-white px-4 py-5 text-center">
              <p className="text-3xl font-bold text-[hsl(221_92%_45%)]">{productsInStockLabel}</p>
              <p className="mt-1 text-sm text-[hsl(220_12%_38%)]">Products in Stock</p>
            </div>
          </div>
        </section>

        <SiteFooter className="mt-12" />
      </main>
    </div>
  );
}
