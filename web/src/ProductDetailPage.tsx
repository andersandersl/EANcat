import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
import { getProductByEan } from './api';
import type { MarginGrade, PublicProduct } from './types';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

const GRADE_BADGE: Record<MarginGrade, string> = {
  A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  B: 'bg-lime-50 text-lime-700 border-lime-200',
  C: 'bg-amber-50 text-amber-700 border-amber-200',
  D: 'bg-orange-50 text-orange-700 border-orange-200',
  E: 'bg-rose-50 text-rose-700 border-rose-200',
  F: 'bg-red-50 text-red-700 border-red-200',
  'N/A': 'bg-gray-100 text-gray-500 border-gray-200',
};

function formatCategoryDisplayName(value: string): string {
  const afterChevron = value.includes('>') ? value.split('>').at(-1) ?? value : value;
  const normalized = afterChevron.trim();
  if (normalized.includes(' - ')) {
    return normalized.split(' - ').at(-1)?.trim() || normalized;
  }
  return normalized;
}

// Estimated margin range from the public grade — mirrors App.tsx marginRangeLabel.
function marginRangeLabel(grade: MarginGrade, marketPrice: number | null, currency: string | null): string | null {
  if (!marketPrice || marketPrice <= 0 || grade === 'N/A') return null;
  const marketCurrency = (currency || 'EUR').toUpperCase();
  const resolvedCurrency = marketCurrency === 'DKK' || marketCurrency === 'SEK' || marketCurrency === 'EUR'
    ? marketCurrency
    : 'EUR';
  const localeByCurrency: Record<string, string> = {
    DKK: 'da-DK',
    SEK: 'sv-SE',
    EUR: 'fi-FI',
  };
  const fmt = (v: number) => new Intl.NumberFormat(localeByCurrency[resolvedCurrency], {
    style: 'currency',
    currency: resolvedCurrency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  const zeroLabel = fmt(0);
  switch (grade) {
    case 'A': return `More than +${fmt(marketPrice * 0.20)}`;
    case 'B': return `Between ${fmt(marketPrice * 0.10)} to ${fmt(marketPrice * 0.20)}`;
    case 'C': return `Between ${fmt(marketPrice * 0.05)} to ${fmt(marketPrice * 0.10)}`;
    case 'D': return `Between ${zeroLabel} to ${fmt(marketPrice * 0.05)}`;
    case 'E': return `Loss between ${zeroLabel} and -${fmt(marketPrice * 0.10)}`;
    case 'F': return `Less than -${fmt(marketPrice * 0.10)}`;
    default: return null;
  }
}

function competitionLabel(count: number): string {
  if (count <= 0) return 'No competition';
  if (count === 1) return 'Low competition';
  if (count <= 3) return 'Medium competition';
  return 'High competition';
}

export default function ProductDetailPage() {
  const { ean } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const market = (() => {
    const m = (new URLSearchParams(location.search).get('market') || '').toLowerCase();
    return m === 'dk' || m === 'se' || m === 'fi' ? m : 'fi';
  })();

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useDocumentMeta({
    title: product ? `${product.brand} ${product.title}` : ean ? `Product ${ean}` : 'Product Details',
    description: product
      ? `View ${product.title} by ${product.brand} with EAN data, stock status, margin grade, and market pricing insights in the EANrunner catalog.`
      : 'View product details in the EANrunner wholesale catalog, including stock status, pricing, and margin insights.',
    path: ean ? `/product/${encodeURIComponent(ean)}` : '/product',
  });

  useEffect(() => {
    if (!ean) return;
    let active = true;
    setLoading(true);
    setError('');
    setProduct(null);

    getProductByEan(ean, market)
      .then((data) => {
        if (!active) return;
        setProduct(data.product);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load product');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ean, market]);

  if (loading && !product) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[hsl(220_18%_97%)]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(221_92%_55%)]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[hsl(220_18%_97%)] gap-4">
        <p className="text-red-600">{error || 'Product not found'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[hsl(221_92%_55%)] hover:underline cursor-pointer">← Back</button>
      </div>
    );
  }

  const inStock = product.stockStatus === 'in stock';
  const rangeLabel = marginRangeLabel(product.marginGrade, product.marketPrice, product.marketCurrency);

  return (
    <div className="min-h-screen bg-[hsl(220_18%_97%)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 h-14 flex items-center gap-3 px-5 border-b border-[hsl(220_14%_89%)] bg-white/90 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[hsl(220_12%_40%)] hover:text-[hsl(222_47%_8%)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-[hsl(220_14%_83%)]">/</span>
        <span className="text-sm font-semibold text-[hsl(222_47%_8%)] truncate">{product.title}</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image */}
        <div>
          <div className="bg-white rounded-xl border border-[hsl(220_14%_89%)] aspect-square flex items-center justify-center overflow-hidden p-6">
            {product.image ? (
              <img
                src={product.image}
                alt={product.title}
                width={600}
                height={600}
                decoding="async"
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-20 h-20 bg-[hsl(220_14%_89%)] rounded-lg flex items-center justify-center">
                <Package className="w-8 h-8 text-[hsl(220_12%_60%)]" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Core info */}
        <div className="space-y-5">
          <div>
            <p className="text-sm text-[hsl(220_12%_50%)] font-medium">{product.brand}</p>
            <h1 className="text-xl font-bold text-[hsl(222_47%_8%)] mt-1 leading-snug">{product.title}</h1>
            <p className="text-xs text-[hsl(220_12%_50%)] mt-1 font-mono">EAN: {product.ean}</p>
          </div>

          {/* Stock + competition */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              inStock
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {inStock ? 'In stock' : 'Out of stock'}
            </span>
            <span className="text-xs text-[hsl(220_12%_45%)]">{competitionLabel(product.competitorCount)}</span>
          </div>

          {/* Margin grade + estimated range */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold ${GRADE_BADGE[product.marginGrade]}`}>
              {product.marginGrade}
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[hsl(220_12%_55%)] font-semibold">Margin grade</p>
              {rangeLabel && <p className="text-xs font-medium text-[hsl(222_47%_20%)]">Est. margin: {rangeLabel}</p>}
            </div>
          </div>

          {product.category && (
            <div className="bg-white rounded-lg border border-[hsl(220_14%_89%)] px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-[hsl(220_12%_55%)] font-semibold">Category</p>
              <p className="text-xs font-medium text-[hsl(222_47%_8%)] mt-0.5">{formatCategoryDisplayName(product.category)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-8">
        <SiteFooter className="mt-2" />
      </div>
    </div>
  );
}
