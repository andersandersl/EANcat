import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Tag, Package, Layers } from 'lucide-react';
import { getProductByEan, getProductDetail } from './api';
import type { ProductFullDetail, PublicProduct } from './types';
import RequestSupplierModal from './components/RequestSupplierModal';
import { sanitizeHtml } from './sanitizeHtml';
import { useAuth } from './auth-context';

const LANG_LABELS: Record<string, string> = {
  'en': 'English',
  'da-DK': 'Danish',
  'sv-SE': 'Swedish',
  'fi-FI': 'Finnish',
  'de': 'German',
  'fr': 'French',
  'nl': 'Dutch',
};

function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code;
}

export default function ProductDetailPage() {
  const { user, idToken, approvedAccount, loading: authLoading } = useAuth();
  const { ean } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const [productSummary, setProductSummary] = useState<PublicProduct | null>(null);
  const [product, setProduct] = useState<ProductFullDetail | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [requestModal, setRequestModal] = useState(false);

  const hasSupplierAccess = (approvedAccount?.allowedSuppliers?.length || 0) > 0 || approvedAccount?.isSuperAdmin === true;

  useEffect(() => {
    if (!ean) return;
    if (authLoading) return;
    if (user && hasSupplierAccess && !idToken) return;

    let active = true;
    setLoadingSummary(true);
    setLoadingDetails(true);
    setError('');
    setDetailError('');
    setProductSummary(null);
    setProduct(null);
    setActiveImage(0);

    getProductByEan(ean, idToken)
      .then((data) => {
        if (!active) return;
        setProductSummary(data.product);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load product');
      })
      .finally(() => {
        if (active) setLoadingSummary(false);
      });

    getProductDetail(ean, idToken, approvedAccount?.allowedSuppliers, approvedAccount?.email)
      .then((data) => {
        if (!active) return;
        setProduct(data);
        setActiveImage(0);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Could not load product details';
        if (!productSummary) setError(message);
        setDetailError(message);
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [ean, idToken, approvedAccount?.allowedSuppliers, approvedAccount?.email, authLoading, user, hasSupplierAccess]);

  if (loadingSummary && !productSummary) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[hsl(220_18%_97%)]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(221_92%_55%)]" />
      </div>
    );
  }

  if (error || (!product && !productSummary)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[hsl(220_18%_97%)] gap-4">
        <p className="text-red-600">{error || 'Product not found'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[hsl(221_92%_55%)] hover:underline cursor-pointer">← Back</button>
      </div>
    );
  }

  const displayTitle = product?.title ?? productSummary?.title ?? '';
  const displayBrand = product?.brand ?? productSummary?.brand ?? '';
  const displayEan = product?.ean ?? productSummary?.ean ?? ean ?? '';
  const displaySupplierCount = product?.supplierCount ?? (productSummary?.supplierRows?.length ?? 0);
  const hasTranslations = (product?.translations.length ?? 0) > 0;
  const hasDimensions = product ? Object.values(product.dimensions).some((v) => v != null) : false;
  const hasAttributes = product ? Object.keys(product.attributeGroups).length > 0 : false;
  const imageList = product?.images ?? (productSummary?.image ? [productSummary.image] : []);

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
        <span className="text-sm font-semibold text-[hsl(222_47%_8%)] truncate">{displayTitle}</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Images */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-[hsl(220_14%_89%)] aspect-square flex items-center justify-center overflow-hidden p-6">
            {imageList.length > 0 ? (
              <img
                src={imageList[activeImage]}
                alt={displayTitle}
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-20 h-20 bg-[hsl(220_14%_89%)] rounded-lg flex items-center justify-center">
                <Package className="w-8 h-8 text-[hsl(220_12%_60%)]" />
              </div>
            )}
          </div>
          {imageList.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {imageList.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-lg border-2 overflow-hidden bg-white flex items-center justify-center p-1 transition-colors cursor-pointer ${
                    i === activeImage ? 'border-[hsl(221_92%_55%)]' : 'border-[hsl(220_14%_89%)] hover:border-[hsl(221_92%_70%)]'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Core info */}
        <div className="space-y-5">
          <div>
            <p className="text-sm text-[hsl(220_12%_50%)] font-medium">{displayBrand}</p>
            <h1 className="text-xl font-bold text-[hsl(222_47%_8%)] mt-1 leading-snug">{displayTitle}</h1>
            <p className="text-xs text-[hsl(220_12%_50%)] mt-1 font-mono">EAN: {displayEan}</p>
          </div>

          {/* Stock info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              displaySupplierCount > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${displaySupplierCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {displaySupplierCount > 0 ? 'In stock' : 'Out of stock'}
            </span>
            {displaySupplierCount > 0 && (
              <span className="text-xs text-[hsl(220_12%_45%)]">
                <strong className="text-[hsl(222_47%_8%)]">{displaySupplierCount}</strong> supplier{displaySupplierCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loadingDetails && (
            <div className="rounded-lg border border-[hsl(220_14%_89%)] bg-white px-3 py-2 text-xs text-[hsl(220_12%_45%)]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(221_92%_55%)]" />
                Loading full product details...
              </span>
            </div>
          )}

          {!loadingDetails && detailError && !product && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Additional product details are taking longer than expected.
            </div>
          )}

          {user && !hasSupplierAccess && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Your account is approved for login, but has no supplier permissions yet. Contact support to assign allowed suppliers.
            </div>
          )}

          {/* Quick specs */}
          {product && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {product.category && <Spec label="Category" value={product.category} />}
              {product.model && <Spec label="Model" value={product.model} />}
              {product.mpn && <Spec label="MPN" value={product.mpn} />}
              {product.color && <Spec label="Color" value={product.color} />}
              {product.countryOfOrigin && <Spec label="Origin" value={product.countryOfOrigin} />}
            </div>
          )}

          {/* Request supplier button */}
          <button
            onClick={() => setRequestModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[hsl(221_92%_55%)] rounded-lg hover:bg-[hsl(221_92%_48%)] transition-colors cursor-pointer"
          >
            <Tag className="w-4 h-4" />
            Request supplier details
          </button>

          {/* English description */}
          {product?.description && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)] mb-1.5">Description (EN)</h2>
              <div
                className="text-sm text-[hsl(222_20%_20%)] leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Translations */}
      {product && hasTranslations && (
        <Section title="Translations" icon={<Layers className="w-4 h-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {product.translations.map((t) => (
              <div key={t.languageCode} className="bg-white rounded-lg border border-[hsl(220_14%_89%)] p-4 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">{langLabel(t.languageCode)}</p>
                {t.title && <p className="text-sm font-semibold text-[hsl(222_47%_8%)]">{t.title}</p>}
                {t.description && (
                  <div
                    className="text-xs text-[hsl(222_20%_30%)] leading-relaxed line-clamp-6"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.description) }}
                  />
                )}
                {!t.description && <p className="text-xs text-[hsl(220_12%_60%)] italic">Title only</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Dimensions */}
      {product && hasDimensions && (
        <Section title="Dimensions & Weight">
          <div className="flex flex-wrap gap-4">
            {product.dimensions.widthMm != null && <Metric label="Width" value={`${product.dimensions.widthMm} mm`} />}
            {product.dimensions.heightMm != null && <Metric label="Height" value={`${product.dimensions.heightMm} mm`} />}
            {product.dimensions.depthMm != null && <Metric label="Depth" value={`${product.dimensions.depthMm} mm`} />}
            {product.dimensions.weightG != null && <Metric label="Weight" value={`${product.dimensions.weightG} g`} />}
          </div>
        </Section>
      )}

      {/* Attributes */}
      {product && hasAttributes && (
        <Section title="Specifications">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(product.attributeGroups).map(([group, attrs]) => (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)] mb-2">{group}</p>
                <dl className="space-y-1">
                  {Object.entries(attrs).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <dt className="text-[hsl(220_12%_45%)] shrink-0 w-32 truncate">{k}</dt>
                      <dd className="text-[hsl(222_47%_8%)] font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="h-16" />

      {requestModal && (
        <RequestSupplierModal
          ean={displayEan}
          title={displayTitle}
          sourcePage="webversion-detail"
          onClose={() => setRequestModal(false)}
        />
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-[hsl(220_14%_89%)] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-[hsl(220_12%_55%)] font-semibold">{label}</p>
      <p className="text-xs font-medium text-[hsl(222_47%_8%)] mt-0.5 truncate">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-[hsl(220_14%_89%)] px-4 py-3 text-center min-w-[90px]">
      <p className="text-[9px] uppercase tracking-wider text-[hsl(220_12%_55%)] font-semibold">{label}</p>
      <p className="text-sm font-bold text-[hsl(222_47%_8%)] mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 border-t border-[hsl(220_14%_89%)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(222_47%_8%)] mb-4">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

