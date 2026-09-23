import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Menu, Search } from 'lucide-react';

export default function PageTopBar() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isMobileViewport = viewportWidth < 768;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && (!target || !menuRef.current.contains(target))) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (query) {
      navigate(`/?q=${encodeURIComponent(query)}`);
      return;
    }
    navigate('/');
  };

  return (
    <div className="sticky top-0 z-40 border-b border-[hsl(220_14%_91%)] bg-[hsl(220_18%_97%)]/95 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[1760px] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to="/" className="inline-flex h-9 shrink-0 items-center px-0.5">
            <img
              src="/marketing/logo-ean.png"
              alt="EANrunner"
              className="h-6 w-auto object-contain"
            />
          </Link>

          <form
            onSubmit={handleSubmit}
            className={`flex min-h-9 flex-1 items-center rounded-lg border border-[hsl(220_14%_89%)] bg-white px-2 ${
              isMobileViewport ? 'order-2 basis-full min-w-0' : 'h-9 min-w-[260px]'
            }`}
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center text-[hsl(220_12%_55%)]"
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search EAN, Title, MPN of 54 556 products"
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-xs text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none"
            />
            {isMobileViewport && (
              <button className="inline-flex h-7 shrink-0 items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-2 text-[11px] font-semibold text-[hsl(222_47%_20%)]">
                <Filter className="mr-1 h-3 w-3" />
                Filters
              </button>
            )}
          </form>

          <div className={`ml-auto flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-[hsl(220_12%_50%)] ${isMobileViewport ? 'order-1' : ''}`}>
            {!isMobileViewport && (
              <>
                <button className="inline-flex h-7 items-center rounded-md border border-[hsl(220_16%_84%)] bg-white px-2 text-[11px] font-semibold text-[hsl(222_47%_20%)]">
                  <Filter className="mr-1 h-3 w-3" />
                  Filters
                </button>
                <div className="inline-flex h-7 items-center overflow-hidden rounded-md border border-[hsl(220_16%_84%)] bg-white">
                  <button className="h-full bg-[hsl(221_84%_95%)] px-2 text-[10px] font-semibold text-[hsl(221_72%_32%)]">
                    Pictures
                  </button>
                  <button className="h-full border-l border-[hsl(220_16%_84%)] px-2 text-[10px] font-semibold text-[hsl(220_12%_45%)]">
                    List
                  </button>
                </div>
                <a
                  href="https://app.eanrunner.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg border border-[hsl(220_16%_84%)] bg-white px-3 text-xs font-semibold text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
                >
                  Login
                </a>
              </>
            )}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(220_16%_84%)] bg-white text-[hsl(222_47%_20%)] hover:bg-[hsl(220_18%_95%)]"
                aria-label="Open menu"
                title="Menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-11 z-50 w-[296px] rounded-xl border border-[hsl(220_16%_84%)] bg-white p-4 shadow-[0_12px_30px_rgb(18_32_74/0.18)]">
                  <div className="space-y-4 text-[13px] text-[hsl(222_47%_18%)]">
                    <section>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Explore</p>
                      <div className="flex flex-col gap-1 text-[13px] leading-6">
                        <Link to="/for-retailers" className="hover:underline" onClick={() => setMenuOpen(false)}>For Retailers</Link>
                        <Link to="/for-distributors" className="hover:underline" onClick={() => setMenuOpen(false)}>For Distributors</Link>
                        <Link to="/pricing" className="hover:underline" onClick={() => setMenuOpen(false)}>Pricing</Link>
                        <Link to="/about-us" className="hover:underline" onClick={() => setMenuOpen(false)}>About us</Link>
                        <Link to="/how-it-works" className="hover:underline" onClick={() => setMenuOpen(false)}>How it works</Link>
                        <Link to="/work-with-us" className="hover:underline" onClick={() => setMenuOpen(false)}>Small team. Big network.</Link>
                      </div>
                    </section>

                    <section className="border-t border-[hsl(220_14%_90%)] pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Company</p>
                      <div className="flex flex-col gap-0.5 text-[13px] leading-6 text-[hsl(220_14%_36%)]">
                        <p>EANrunner by Etaility AB</p>
                        <p>VAT SE559006389601</p>
                        <a href="mailto:info@eanrunner.com" className="font-medium text-[hsl(221_92%_42%)] hover:underline">info@eanrunner.com</a>
                      </div>
                    </section>

                    <section className="border-t border-[hsl(220_14%_90%)] pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(220_12%_46%)]">Follow</p>
                      <a href="https://www.linkedin.com/company/eanrunner" target="_blank" rel="noreferrer" className="text-[13px] leading-6 hover:underline">LinkedIn</a>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
