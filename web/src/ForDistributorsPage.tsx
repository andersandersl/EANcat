import { Layers, Users, Zap, Package } from 'lucide-react';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function ForDistributorsPage() {
  useDocumentMeta({
    title: 'For Distributors: Reach More Retailers',
    description:
      'Connect your catalog once and reach more retailers across Europe with structured product data, feed handling, and faster channel onboarding.',
    path: '/for-distributors',
  });

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:py-8">
        <div className="h-4" />

        <section className="grid items-stretch gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="pt-3">
            <h1 className="text-4xl font-bold leading-[1.04] text-[hsl(222_47%_10%)] sm:text-[52px]">
              <span className="text-[hsl(221_92%_50%)]">One connection. </span>
              <br />
              European reach.
            </h1>
            <ul className="mt-6 space-y-2.5 text-[16px] leading-relaxed text-[hsl(220_14%_30%)]">
              <li>✓ Connect your product data to our system</li>
              <li>✓ Access our network of shops in Europe</li>
              <li>✓ Increase sell-through without expanding your sales team</li>
            </ul>
            <p className="mt-6 max-w-[56ch] rounded-md border border-[hsl(220_16%_84%)] bg-white px-4 py-3 text-sm font-medium text-[hsl(220_14%_28%)]">
              Want access? Contact us at{' '}
              <a href="mailto:info@eanrunner.com" className="font-semibold text-[hsl(221_92%_42%)] hover:underline">
                info@eanrunner.com
              </a>
              {' '}and we will help you get started.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[hsl(220_16%_86%)]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: "linear-gradient(148deg, rgba(14,25,54,0.84), rgba(26,51,122,0.56)), url('/marketing/distributor-mood.png')",
              }}
            />
            <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-end p-6 text-white">
              <p className="text-[13px] font-medium text-white/80">Let&apos;s understand your needs</p>
            </div>
          </div>
        </section>

        <div className="h-24 sm:h-28" />

        <section className="text-center">
          <h2 className="text-3xl font-bold text-[hsl(222_47%_12%)] sm:text-[38px]">New markets are awaiting your products</h2>
        </section>

        <div className="h-14 sm:h-16" />

        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h2 className="text-[32px] font-bold leading-tight text-[hsl(222_47%_12%)]">EU is fragmented. We make it accessible.</h2>
            <p className="mt-3 text-[16px] text-[hsl(220_14%_34%)]">Connect your dropshipping or cross-docking-ready inventory to our system.</p>
            <ul className="mt-4 space-y-2 text-[15px] text-[hsl(220_14%_30%)]">
              <li>✓ Deliver your product data through feeds or API</li>
              <li>✓ Include relevant data such as price, stock, images and more</li>
              <li>✓ We will clean the data and make it ready for the shops</li>
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <img
              src="/marketing/distributor-1.png"
              alt="Distributor workflow"
              className="h-full min-h-[290px] w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <div className="h-14 sm:h-16" />

        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-[32px] font-bold leading-tight text-[hsl(222_47%_12%)]">Your distribution grows as our network grows.</h2>
            <p className="mt-3 text-[16px] text-[hsl(220_14%_34%)]">We have a network of shops across Europe, ready to sell your products.</p>
            <ul className="mt-4 space-y-2 text-[15px] text-[hsl(220_14%_30%)]">
              <li>✓ We will help you find the best shops for your products</li>
              <li>✓ Make direct agreements with the shops</li>
              <li>✓ Everything is digitalized and can be managed in one place</li>
            </ul>
          </div>
          <div>
            <img
              src="/marketing/shop-2.png"
              alt="Shops network"
              className="h-full min-h-[290px] w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <div className="h-14 sm:h-16" />

        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <h2 className="text-[32px] font-bold leading-tight text-[hsl(222_47%_12%)]">We do the groundwork. You grow your shelf space.</h2>
            <p className="mt-3 text-[16px] text-[hsl(220_14%_34%)]">EANrunner is built to maximize relevant shelf-space per store.</p>
            <ul className="mt-4 space-y-2 text-[15px] text-[hsl(220_14%_30%)]">
              <li>✓ We make it easy for the shops to find the best products</li>
              <li>✓ We enrich the product data and secure local translations</li>
              <li>✓ We make it easy for the shops to add new products to their store</li>
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <img
              src="/marketing/distributor-2.png"
              alt="Distributor growth"
              className="h-full min-h-[290px] w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <div className="h-24 sm:h-28" />

        <section className="rounded-2xl border border-[hsl(221_35%_88%)] bg-[hsl(221_60%_97%)] px-6 py-7 sm:px-8">
          <div className="mb-4 flex items-center gap-2.5 text-[hsl(221_72%_38%)]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(220_16%_84%)] bg-white"><Package className="h-4 w-4" /></span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(220_16%_84%)] bg-white"><Zap className="h-4 w-4" /></span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(220_16%_84%)] bg-white"><Users className="h-4 w-4" /></span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(220_16%_84%)] bg-white"><Layers className="h-4 w-4" /></span>
          </div>
          <h2 className="text-[32px] font-bold leading-tight text-[hsl(222_47%_12%)]">Digitalized orders, seamless integrations.</h2>
          <p className="mt-3 text-[16px] text-[hsl(220_14%_34%)]">
            Don&apos;t waste time in back-and-forth communication. We gather all orders for you
            in one easy-to-use platform.
          </p>
          <ul className="mt-4 space-y-2 text-[15px] text-[hsl(220_14%_30%)]">
            <li>✓ Receive orders from our network of shops</li>
            <li>✓ Approve or reject orders in one click</li>
            <li>✓ Integrate with your existing systems</li>
            <li>✓ No more manual data entry or lost orders</li>
          </ul>
        </section>

        <SiteFooter className="mt-10" />
      </div>
    </div>
  );
}
