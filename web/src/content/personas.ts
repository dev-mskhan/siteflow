export interface PersonaBenefit {
  title: string;
  description: string;
}

export interface PersonaContent {
  slug: string;
  title: string;
  badge: string;
  headline: string;
  supportingSentence: string;
  problem: string;
  benefits: PersonaBenefit[];
  workflowSteps: { num: string; title: string; desc: string }[];
  faqs: { question: string; answer: string }[];
  relatedLinks: { title: string; href: string }[];
}

export const PERSONAS_DATA: Record<string, PersonaContent> = {
  'general-contractors': {
    slug: 'general-contractors',
    title: 'General Contractors',
    badge: 'Prime Construction Management',
    headline: 'Protect project margins across multiple active job sites',
    supportingSentence: 'SiteFlow gives general contractors real-time cost visibility, daily site supervisor logs, and streamlined subcontractor payment approvals.',
    problem: 'General contractors juggle multiple job sites with thin 12-18% target margins. Delays from one trade create chain reactions across the entire schedule, while late payment claims from owners squeeze cashflow.',
    benefits: [
      {
        title: 'Multi-project cashflow visibility',
        description: 'See baseline budget, committed purchase orders, actual expenses, and forecast at completion across all active jobs in one view.',
      },
      {
        title: 'Daily supervisor accountability',
        description: 'Require site supervisors to submit daily labor headcounts and progress logs before leaving the site each afternoon.',
      },
      {
        title: 'Subcontractor payment control',
        description: 'Approve trade payment applications only after site supervisors verify actual work completed and retainage is deducted.',
      },
      {
        title: 'Change order protection',
        description: 'Record client design changes with photographs and cost estimates before work begins to avoid unpaid disputes at handover.',
      },
    ],
    workflowSteps: [
      { num: '01', title: 'Lock Project Baseline', desc: 'Import the approved Bill of Quantities and establish cost codes for all major trades.' },
      { num: '02', title: 'Issue Trade Contracts', desc: 'Award trade scopes and set retainage percentages and milestone payment schedules.' },
      { num: '03', title: 'Review Daily Site Logs', desc: 'Monitor manpower and material deliveries directly from supervisors on the ground.' },
      { num: '04', title: 'Certify Progress Claims', desc: 'Generate verified client billing certificates and release approved trade payments.' },
    ],
    faqs: [
      {
        question: 'How quickly can our team get started on an active job?',
        answer: 'You can set up a project in under 15 minutes by uploading an existing Bill of Quantities spreadsheet and inviting your site supervisors via email.',
      },
      {
        question: 'Can our project managers use this on site tablets?',
        answer: 'Yes. The interface is optimized for field tablets and mobile phones with fast loading, offline entry, and clear touch controls.',
      },
      {
        question: 'Does SiteFlow support multiple currencies across different projects?',
        answer: 'Yes. You can manage local projects in PKR with Marla/Kanal units, and international projects in USD with standard CSI divisions simultaneously.',
      },
    ],
    relatedLinks: [
      { title: 'Cost Control Feature', href: '/features/cost-control' },
      { title: 'Field Logs Feature', href: '/features/field-logs' },
      { title: 'Estimating & BOQ', href: '/features/estimating-and-boq' },
    ],
  },

  subcontractors: {
    slug: 'subcontractors',
    title: 'Subcontractors',
    badge: 'Trade Contractor Portal',
    headline: 'Submit clear progress claims and get paid without delays',
    supportingSentence: 'Give your team a straightforward trade portal to log completed work, verify retainage withholdings, and eliminate invoice arguments.',
    problem: 'Subcontractors often wait 45 to 60 days to get paid because contractors dispute work quantities or claim that previous advance payments were miscalculated.',
    benefits: [
      {
        title: 'Transparent scope tracking',
        description: 'View awarded line items, agreed unit rates, and approved completion percentages in one shared record.',
      },
      {
        title: 'Clear payment applications',
        description: 'Submit progress claims with photos of completed work. Track gross amount, retainage withheld, and net payable balance.',
      },
      {
        title: 'Retainage tracking',
        description: 'Always know exactly how much retainage is currently withheld and view the scheduled release date after handover.',
      },
      {
        title: 'No confusing software training',
        description: 'A clean, dedicated portal showing only your trade items without confusing general contractor admin settings.',
      },
    ],
    workflowSteps: [
      { num: '01', title: 'Review Awarded Scope', desc: 'Access your assigned line items, quantities, unit rates, and contract sum.' },
      { num: '02', title: 'Perform Site Work', desc: 'Execute structural, masonry, MEP, or finishing scopes according to schedule.' },
      { num: '03', title: 'Submit Progress Claim', desc: 'Enter completion percentage and attach photos of finished work for inspection.' },
      { num: '04', title: 'Receive Certified Payment', desc: 'Track approved payment certificates and cleared bank settlements directly.' },
    ],
    faqs: [
      {
        question: 'Can the general contractor see my internal costs or profit?',
        answer: 'Never. The contractor only sees your agreed contract line items and claims. Your internal labor rates and supplier costs remain completely private.',
      },
      {
        question: 'Do I need to pay for a subscription to submit claims to my general contractor?',
        answer: 'No. Subcontractors invited to a general contractor project can access their trade portal and submit payment claims free of charge.',
      },
      {
        question: 'How do I know when my payment is approved?',
        answer: 'You receive an instant notification when the site supervisor verifies your work and when finance authorizes the payment certificate.',
      },
    ],
    relatedLinks: [
      { title: 'Billing & Payments Feature', href: '/features/billing-and-payments' },
      { title: 'Subcontractors Feature', href: '/features/subcontractors' },
      { title: 'Pricing Plans', href: '/pricing' },
    ],
  },

  'project-owners': {
    slug: 'project-owners',
    title: 'Project Owners & Developers',
    badge: 'Owner Transparency Portal',
    headline: 'Verify certified construction progress and spending in real time',
    supportingSentence: 'Give real estate developers and project owners clear visibility into certified work completion, change orders, and payment approvals.',
    problem: 'Project owners receive large monthly contractor invoices with minimal supporting documentation. Verifying whether the 4th-floor slab was actually cast before writing a multimillion check requires slow site visits.',
    benefits: [
      {
        title: 'Certified progress tracking',
        description: 'Review contractor billing claims with attached inspection photos and consultant sign-offs before approving payment.',
      },
      {
        title: 'Change order transparency',
        description: 'Review and approve variation requests digitally with itemized cost breakdowns and photographic justification.',
      },
      {
        title: 'Retainage escrow overview',
        description: 'Track accumulated retainage reserves and defect liability balances across all contracted packages.',
      },
      {
        title: 'Milestone timeline verification',
        description: 'Monitor structural milestones and target handover dates without relying on outdated monthly PowerPoint summaries.',
      },
    ],
    workflowSteps: [
      { num: '01', title: 'Review Contract Baseline', desc: 'Inspect the contracted Bill of Quantities, baseline budget, and key milestones.' },
      { num: '02', title: 'Monitor Daily Milestones', desc: 'Check photo logs and certified site progress reports as work moves forward.' },
      { num: '03', title: 'Review Change Orders', desc: 'Approve or question proposed scope variations with clear cost and schedule impact.' },
      { num: '04', title: 'Audit Interim Certificates', desc: 'Verify work completed before releasing progress payments through your bank.' },
    ],
    faqs: [
      {
        question: 'Can owners edit the contractor BOQ or costs?',
        answer: 'No. Project owners have read-only audit access with specific approval permissions for formal change orders and interim payment applications.',
      },
      {
        question: 'Can multiple partners or bank inspectors access the project?',
        answer: 'Yes. You can grant view-only auditor access to lenders, quantity surveyors, and development partners.',
      },
      {
        question: 'How are photo records verified?',
        answer: 'Every photo uploaded by site supervisors includes an immutable date stamp and location tag linked to specific BOQ line items.',
      },
    ],
    relatedLinks: [
      { title: 'Change Orders Feature', href: '/features/change-orders' },
      { title: 'Security Architecture', href: '/security' },
      { title: 'Contact Sales', href: '/contact' },
    ],
  },
};
