import { useEffect } from 'react';

export interface DocumentMetaOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

const SITE_NAME = 'EANrunner';
const DEFAULT_DESCRIPTION = 'Browse products, brands, stock, pricing, and margin insights in EANrunner.';

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function cleanTitle(value: string): string {
  return value.replace(/\bWholesale\b\s*/gi, '').replace(/\s{2,}/g, ' ').trim();
}

function titleFromPath(pathname: string): string {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/') return 'Product catalog';
  if (path.startsWith('/brand/')) {
    const brand = decodeURIComponent(path.slice('/brand/'.length).split('/')[0] || '').trim();
    return brand ? `${brand} products` : 'Brand products';
  }
  if (path.startsWith('/product/')) return 'Product details';
  if (path === '/about-us') return 'About us';
  if (path === '/how-it-works') return 'How it works';
  if (path === '/for-retailers') return 'For retailers';
  if (path === '/for-distributors') return 'For distributors';
  if (path === '/pricing') return 'Pricing';
  if (path === '/pricing/distributors') return 'Distributor pricing';
  if (path === '/pricing/retailers') return 'Retailer pricing';
  if (path === '/pricing/retailers/own-suppliers') return 'Own suppliers pricing';
  if (path === '/get-approved') return 'Get approved';
  if (path === '/work-with-us') return 'Work with us';
  if (path === '/blog') return 'Blog';
  if (path.startsWith('/blog/')) return 'Blog post';
  if (path === '/contact') return 'Contact';
  if (path === '/privacy-policy') return 'Privacy policy';
  if (path === '/ir' || path === '/ir-v2') return 'Investor relations';
  return 'Product catalog';
}

function buildTitle(title: string | undefined, path?: string): string {
  const routeTitle = titleFromPath(path || (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const cleanedTitle = cleanTitle(title || '');
  const genericTitle = !cleanedTitle || /^(EANrunner|Product catalog|Wholesale Product Catalog)$/i.test(cleanedTitle);
  const baseTitle = genericTitle ? routeTitle : cleanedTitle.replace(new RegExp(`\s*\|\s*${SITE_NAME}$`), '').trim();
  return `${baseTitle} | ${SITE_NAME}`;
}

export function useDocumentMeta(options: DocumentMetaOptions): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}${window.location.search}`
      : options.path || '/';
    const image = options.image
      ? (options.image.startsWith('http') ? options.image : `${origin}${options.image}`)
      : `${origin}/marketing/share-card.svg`;
    const title = buildTitle(options.title, options.path);
    const description = options.description?.trim() || DEFAULT_DESCRIPTION;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setMeta('name', 'robots', options.noIndex ? 'noindex,nofollow' : 'index,follow');
    setCanonical(url.split('?')[0]);
  }, [options.description, options.image, options.noIndex, options.path, options.title]);
}

export default useDocumentMeta;