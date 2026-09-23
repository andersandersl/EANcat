import { Link } from 'react-router-dom';

type SiteFooterProps = {
  className?: string;
};

export default function SiteFooter({ className = 'mt-10' }: SiteFooterProps) {
  return (
    <div className={`${className} relative left-1/2 w-screen -translate-x-1/2 px-4`}>
      <footer className="mx-auto w-full max-w-[1760px] rounded-2xl border border-[hsl(220_16%_88%)] bg-[linear-gradient(180deg,hsl(220_28%_99%)_0%,hsl(220_20%_97%)_45%,hsl(220_18%_96%)_100%)] px-5 py-5 shadow-[0_10px_28px_rgb(18_32_74/0.08)]">
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="space-y-2 lg:col-span-5">
            <img
              src="/marketing/logo-ean.png"
              alt="EANrunner"
              className="h-6 w-auto object-contain"
            />
            <p className="max-w-lg text-[12px] leading-relaxed text-[hsl(220_14%_36%)]">
              EANrunner connects distributors and retailers with live, enriched product data and market-ready catalog automation.
            </p>
            <p className="text-[11px] text-[hsl(220_14%_36%)]">Company registration number: VAT SE559006389601</p>
            <p className="text-[11px] text-[hsl(220_14%_36%)]">
              Email:{' '}
              <a href="mailto:info@eanrunner.com" className="font-medium text-[hsl(221_92%_42%)] hover:underline">info@eanrunner.com</a>
            </p>
          </section>

          <section className="space-y-2 lg:col-span-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_46%)]">Explore</h3>
            <div className="flex flex-col gap-1 text-[12px]">
              <Link to="/for-retailers" className="text-[hsl(221_92%_42%)] hover:underline">For Retailers</Link>
              <Link to="/for-distributors" className="text-[hsl(221_92%_42%)] hover:underline">For Distributors</Link>
              <Link to="/pricing" className="text-[hsl(221_92%_42%)] hover:underline">Pricing</Link>
              <Link to="/about-us" className="text-[hsl(221_92%_42%)] hover:underline">About us</Link>
              <Link to="/how-it-works" className="text-[hsl(221_92%_42%)] hover:underline">How it works</Link>
              <Link to="/work-with-us" className="text-[hsl(221_92%_42%)] hover:underline">Small team. Big network.</Link>
            </div>
          </section>

          <section className="space-y-3 lg:col-span-4">
            <a
              href="https://app.eanrunner.com/login"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[hsl(222_47%_18%)] hover:bg-[hsl(220_18%_95%)]"
            >
              Login
            </a>

            <div className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_46%)]">Follow</h3>
              <a
                href="https://www.linkedin.com/company/eanrunner"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1 text-[12px] font-medium text-[hsl(222_47%_18%)] hover:bg-[hsl(220_18%_95%)]"
              >
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#0A66C2] text-[8px] font-bold text-white">in</span>
                Follow on LinkedIn
              </a>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(220_12%_46%)]">Integrations</h3>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[hsl(222_47%_18%)]">
                  <img src="https://cdn.simpleicons.org/shopify/95BF47" alt="Shopify" className="h-4 w-4" />
                  Shopify
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[hsl(222_47%_18%)]">
                  <img src="https://cdn.simpleicons.org/woocommerce/96588A" alt="WooCommerce" className="h-4 w-4" />
                  WooCommerce
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[hsl(222_47%_18%)]">
                  <img src="/marketing/logos/quickbutik.svg" alt="Quickbutik" className="h-4 w-4 object-contain" />
                  Quickbutik
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[hsl(222_47%_18%)]">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Magento_Logo.svg/120px-Magento_Logo.svg.png" alt="Magento" className="h-4 w-4 object-contain" />
                  Magento
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[hsl(220_16%_84%)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[hsl(222_47%_18%)]">
                  <img src="https://cdn.simpleicons.org/googlebigquery/669DF6" alt="BigQuery" className="h-4 w-4" />
                  BigQuery
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-5 border-t border-[hsl(220_14%_90%)] pt-3 text-[11px] text-[hsl(220_12%_45%)]">
          © {new Date().getFullYear()} EANrunner by Etaility AB. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
