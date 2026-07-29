import { SITE } from './site';
import { PRODUCTS, type Product } from './products';

const ORG_ID = `${SITE.url}/#organization`;
const FOUNDER_ID = `${SITE.url}/about#sam-atherton`;

/** Numeric price for schema.org, derived from the display string. */
function numericPrice(display: string): string {
  return display.replace(/[^0-9.]/g, '');
}

export function professionalService() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': ORG_ID,
    name: SITE.name,
    alternateName: SITE.shortName,
    url: SITE.url,
    description: SITE.description,
    slogan: SITE.tagline,
    email: SITE.email,
    telephone: '+1-424-404-3686',
    priceRange: '$$$',
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Southern California' },
      { '@type': 'Country', name: 'United States' },
    ],
    serviceType: 'College admissions consulting',
    founder: { '@id': FOUNDER_ID },
    knowsAbout: [
      'College admissions',
      'Academic planning',
      'Admissions essay review',
      'Educational consulting',
    ],
    // Deliberately no aggregateRating: the site makes no outcome claims, and
    // fabricating review data would be both false and a rich-results violation.
  };
}

export function founderPerson() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': FOUNDER_ID,
    name: 'Sam Atherton',
    jobTitle: 'Founder and President',
    worksFor: { '@id': ORG_ID },
    affiliation: [
      { '@type': 'CollegeOrUniversity', name: 'Mt. San Antonio College' },
      { '@type': 'CollegeOrUniversity', name: 'University of Southern California' },
    ],
    alumniOf: [
      { '@type': 'CollegeOrUniversity', name: 'University of Southern California' },
      { '@type': 'CollegeOrUniversity', name: 'University of California, Berkeley' },
      { '@type': 'CollegeOrUniversity', name: 'Harvard University' },
      { '@type': 'CollegeOrUniversity', name: 'Benedictine University' },
      { '@type': 'CollegeOrUniversity', name: 'Embry-Riddle Aeronautical University' },
      { '@type': 'CollegeOrUniversity', name: 'Norwich University' },
    ],
    url: `${SITE.url}/about`,
  };
}

export function serviceOffer(product: Product, description: string) {
  const isSubscription = product.mode === 'subscription';

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${SITE.url}/services/${product.slug}#service`,
    name: product.name,
    description,
    serviceType: 'College admissions consulting',
    provider: { '@id': ORG_ID },
    areaServed: { '@type': 'Country', name: 'United States' },
    offers: {
      '@type': 'Offer',
      url: `${SITE.url}/services/${product.slug}`,
      price: numericPrice(product.price),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      ...(isSubscription
        ? {
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: numericPrice(product.price),
              priceCurrency: 'USD',
              billingDuration: 3,
              billingIncrement: 1,
              unitCode: 'MON',
            },
          }
        : {}),
    },
  };
}

export function breadcrumbs(trail: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE.url).href,
    })),
  };
}

export function servicesItemList() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Services',
    itemListElement: Object.values(PRODUCTS).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: `${SITE.url}/services/${product.slug}`,
    })),
  };
}
