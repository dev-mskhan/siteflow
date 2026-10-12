import React from 'react';
import { Helmet } from 'react-helmet-async';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SeoProps {
  title: string;
  description: string;
  canonical: string;
  schemaType?: 'Organization' | 'SoftwareApplication' | 'FAQPage' | 'WebPage';
  faqs?: FaqItem[];
  noindex?: boolean;
}

export const Seo: React.FC<SeoProps> = ({
  title,
  description,
  canonical,
  schemaType = 'WebPage',
  faqs,
  noindex = false,
}) => {
  // Build JSON-LD structured data
  const jsonLdData: Record<string, unknown>[] = [];

  if (schemaType === 'Organization') {
    jsonLdData.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SiteFlow',
      url: 'https://siteflow.app',
      logo: 'https://siteflow.app/vite.svg',
      description:
        'Construction operations platform for small and mid-sized contractors. Budgeting, BOQ, field tracking, procurement, and payment applications in PKR and USD.',
      sameAs: [],
    });
  }

  if (schemaType === 'SoftwareApplication') {
    jsonLdData.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'SiteFlow Construction Platform',
      operatingSystem: 'Web, Android, iOS',
      applicationCategory: 'BusinessApplication',
      description,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: '140',
      },
    });
  }

  if (faqs && faqs.length > 0) {
    jsonLdData.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow" />}

      {/* Open Graph Tags */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content="https://siteflow.app/media/hero-poster.jpg" />
      <meta property="og:image:alt" content="SiteFlow commercial construction site under active execution" />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="https://siteflow.app/media/hero-poster.jpg" />

      {/* JSON-LD Script injection */}
      {jsonLdData.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};
