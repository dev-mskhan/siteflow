/**
 * SEO Metadata and Structured Data (JSON-LD) for all Public Routes
 * Titles: 50-60 characters
 * Descriptions: 150-160 characters
 */

export interface SeoMetadata {
  title: string;
  description: string;
  canonical: string;
  schemaType?: 'Organization' | 'SoftwareApplication' | 'FAQPage' | 'WebPage';
}

export const SEO_DATA: Record<string, SeoMetadata> = {
  home: {
    title: 'SiteFlow | Construction Operations for Contractors',
    description: 'Construction operations platform for small and mid-sized contractors. Budgeting, BOQ, field tracking, procurement, and payment applications in PKR and USD.',
    canonical: 'https://siteflow.app/',
    schemaType: 'Organization',
  },
  featuresOverview: {
    title: 'Features | Construction Management Tools | SiteFlow',
    description: 'Explore SiteFlow features: Bill of Quantities, job costing, daily field logs, procurement, subcontractor tracking, and automated payment certificates.',
    canonical: 'https://siteflow.app/features',
    schemaType: 'SoftwareApplication',
  },
  pricing: {
    title: 'Pricing Plans for General Contractors | SiteFlow',
    description: 'Transparent construction software pricing in PKR and USD. Scalable plans for growing builders and established general contractors without hidden fees.',
    canonical: 'https://siteflow.app/pricing',
    schemaType: 'SoftwareApplication',
  },
  contact: {
    title: 'Book a Demo | Contact Sales Team | SiteFlow',
    description: 'Schedule a tailored 20-minute demonstration of SiteFlow. Ask pricing questions and see how to streamline your construction operations and cashflow.',
    canonical: 'https://siteflow.app/contact',
    schemaType: 'WebPage',
  },
  about: {
    title: 'About SiteFlow | Built for Small & Mid-Sized Builders',
    description: 'Learn why SiteFlow was created to help contractors escape scattered spreadsheets, eliminate payment disputes, and protect project profitability.',
    canonical: 'https://siteflow.app/about',
    schemaType: 'Organization',
  },
  security: {
    title: 'Security & Data Isolation Architecture | SiteFlow',
    description: 'Learn how SiteFlow protects contractor data with strict multi-tenant isolation, role-based access control, project barriers, and immutable audit logs.',
    canonical: 'https://siteflow.app/security',
    schemaType: 'WebPage',
  },
  pakistan: {
    title: 'Construction Software in Pakistan | PKR & BOQ | SiteFlow',
    description: 'Construction operations for Pakistani contractors. Native PKR support, Marla and Kanal units, PRA/FBR withholding tax, and local material specifications.',
    canonical: 'https://siteflow.app/construction-software-pakistan',
    schemaType: 'SoftwareApplication',
  },
  us: {
    title: 'Commercial Construction Management US | SiteFlow',
    description: 'Job costing, AIA-style payment applications with 10% retainage, CSI MasterFormat cost codes, and subcontractor compliance for US general contractors.',
    canonical: 'https://siteflow.app/construction-software-us',
    schemaType: 'SoftwareApplication',
  },
  forGeneralContractors: {
    title: 'Software for General Contractors | Cashflow & SiteFlow',
    description: 'Control multi-project cashflow, track material deliveries, manage subcontractor payments, and monitor job site progress in real time with SiteFlow.',
    canonical: 'https://siteflow.app/for/general-contractors',
    schemaType: 'SoftwareApplication',
  },
  forSubcontractors: {
    title: 'Subcontractor Portal | Payment Applications | SiteFlow',
    description: 'Submit progress claims, track retainage withholdings, and view approved work orders without dealing with confusing contractor spreadsheets.',
    canonical: 'https://siteflow.app/for/subcontractors',
    schemaType: 'SoftwareApplication',
  },
  forProjectOwners: {
    title: 'Project Owner Transparency & Cost Verification | SiteFlow',
    description: 'Verify certified project progress, review change orders, and audit billing documentation with complete visibility into project expenditure.',
    canonical: 'https://siteflow.app/for/project-owners',
    schemaType: 'SoftwareApplication',
  },
  privacy: {
    title: 'Privacy Policy | Data Protection Rules | SiteFlow',
    description: 'Read the SiteFlow privacy policy. How we collect, store, and process organizational data for construction teams with strict confidentiality.',
    canonical: 'https://siteflow.app/privacy',
    schemaType: 'WebPage',
  },
  terms: {
    title: 'Terms of Service | Master Subscription Agreement | SiteFlow',
    description: 'Review the contractual terms and conditions governing the use of the SiteFlow construction operations platform and software services.',
    canonical: 'https://siteflow.app/terms',
    schemaType: 'WebPage',
  },
  cookies: {
    title: 'Cookie Policy | Essential Browser Storage | SiteFlow',
    description: 'Understand how SiteFlow uses essential session cookies to keep you signed in securely and store workspace preferences on your device.',
    canonical: 'https://siteflow.app/cookies',
    schemaType: 'WebPage',
  },
  thanks: {
    title: 'Thank You | We Will Be In Touch Shortly | SiteFlow',
    description: 'Your demo request or message has been received. A construction specialist will review your project details and follow up within one business day.',
    canonical: 'https://siteflow.app/thanks',
    schemaType: 'WebPage',
  },
};
