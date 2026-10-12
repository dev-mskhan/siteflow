export interface FeatureBenefit {
  title: string;
  description: string;
}

export interface FeatureFaq {
  question: string;
  answer: string;
}

export interface FeatureContent {
  slug: string;
  title: string;
  badge: string;
  headline: string; // H1 about the result
  supportingSentence: string;
  problem: string; // The problem in plain words
  benefits: FeatureBenefit[];
  appPreviewDescription: string;
  sampleItems: { code: string; title: string; meta: string; status: 'ontrack' | 'atrisk' | 'delayed' }[];
  faqs: FeatureFaq[];
  relatedSlugs: string[];
}

export const FEATURES_DATA: Record<string, FeatureContent> = {
  'estimating-and-boq': {
    slug: 'estimating-and-boq',
    title: 'Estimating & BOQ',
    badge: 'Scope & Quantity Control',
    headline: 'Build airtight estimates without broken spreadsheet formulas',
    supportingSentence: 'Structure Bill of Quantities items with live unit rates in PKR and USD, lock contract baselines, and prevent unbilled site work.',
    problem: 'Contractors lose thousands when estimates are compiled across five disconnected Excel sheets. Quantities get typed twice, unit rate increases are missed, and revisions override original contractual commitments without a paper trail.',
    benefits: [
      {
        title: 'Structured line-item hierarchy',
        description: 'Organize scope into standard civil divisions. Every item has defined unit rates, quantities, labor allowances, and material tolerances.',
      },
      {
        title: 'Baseline version locking',
        description: 'Once a contract is signed, lock the baseline estimate. Any scope change requires an approved change order, preserving original target margins.',
      },
      {
        title: 'Dual currency calculations',
        description: 'Quote and budget in Pakistani Rupees (PKR) or US Dollars (USD) with local area units (Marla, Kanal, SqFt, Cubic Yards).',
      },
    ],
    appPreviewDescription: 'Live Bill of Quantities grid linking quantities directly to material purchase orders and field inspection logs.',
    sampleItems: [
      { code: '03.14.02', title: 'Deformed Steel Rebar Fe 500D (32mm)', meta: '45.0 Ton @ PKR 265,000 / Ton', status: 'ontrack' },
      { code: '03.20.01', title: 'Ready-Mix Concrete C35/45 Pumping Mix', meta: '320.0 m³ @ PKR 37,800 / m³', status: 'ontrack' },
      { code: '04.10.05', title: 'Class-A Red Clay Brick Masonry', meta: '18,500 Pcs @ PKR 18.5 / Pc', status: 'atrisk' },
    ],
    faqs: [
      {
        question: 'Can I import an existing Bill of Quantities from Excel?',
        answer: 'Yes. You can upload any standard CSV or Excel file. SiteFlow maps your item descriptions, units, quantities, and rates automatically into structured line items.',
      },
      {
        question: 'Can I prevent site teams from editing unit rates?',
        answer: 'Yes. Only users with the Project Manager or Finance role can edit contractual rates and baseline quantities. Site supervisors have view-only access to quantities.',
      },
      {
        question: 'How do unit rate changes affect ongoing projects?',
        answer: 'Locked baseline budgets never change automatically. If supplier material prices rise, you record a price adjustment or change order to maintain clean variance reporting.',
      },
    ],
    relatedSlugs: ['cost-control', 'procurement', 'change-orders'],
  },

  scheduling: {
    slug: 'scheduling',
    title: 'Scheduling',
    badge: 'Timeline & Milestones',
    headline: 'Keep site crews aligned to milestone deadlines every day',
    supportingSentence: 'Connect project phases to daily site work logs so delay warnings surface before critical path deadlines slip.',
    problem: 'Gantt charts made at the beginning of a job often sit untouched in the site cabin. When foundation work slips by three weeks, the project manager only finds out when MEP trades show up unable to work.',
    benefits: [
      {
        title: 'Milestone tracking connected to field logs',
        description: 'Track foundation, structural frame, masonry, and finishing phases directly against daily site supervisor activity entries.',
      },
      {
        title: 'Early warning delay alerts',
        description: 'Identify lagging trades early. Mark milestones as on track, at risk, or delayed with clear notes on what is blocking progress.',
      },
      {
        title: 'Subcontractor crew mobilization',
        description: 'Notify trade subcontractors two weeks before their work zone is ready so labor arrives on time without paying standby fees.',
      },
    ],
    appPreviewDescription: 'Interactive milestone progress board linking structural handoffs directly to material deliveries.',
    sampleItems: [
      { code: 'PH-01', title: 'Substructure Excavation & Raft Casting', meta: '100% Complete • Verified 15 Sep', status: 'ontrack' },
      { code: 'PH-02', title: '4th Floor Reinforced Slab Pour', meta: '68% Complete • Target 20 Oct', status: 'atrisk' },
      { code: 'PH-03', title: 'Exterior Clay Brick Masonry (Level 1-3)', meta: 'Scheduled • Mobilization 28 Oct', status: 'ontrack' },
    ],
    faqs: [
      {
        question: 'Is this a complicated Gantt chart tool?',
        answer: 'No. SiteFlow focuses on practical milestones and phase handoffs that field supervisors actually update and understand on their phones.',
      },
      {
        question: 'Can we record weather delays?',
        answer: 'Yes. Site supervisors can flag days with rain, extreme heat, or site stoppage, automatically documenting the reason for any milestone adjustment.',
      },
      {
        question: 'Can subcontractors view project schedule dates?',
        answer: 'Subcontractors see the scheduled start and target completion dates for their assigned trades only.',
      },
    ],
    relatedSlugs: ['field-logs', 'estimating-and-boq', 'subcontractors'],
  },

  procurement: {
    slug: 'procurement',
    title: 'Procurement',
    badge: 'Purchase Orders & Materials',
    headline: 'Issue purchase orders that tie directly to cost codes',
    supportingSentence: 'Control material purchasing, prevent unauthorized orders, and verify gate receipts before paying suppliers.',
    problem: 'Site supervisors order steel and cement by making phone calls or WhatsApp voice notes. Invoices arrive weeks later with unexpected delivery surcharges, leaving finance with no record of who authorized the order.',
    benefits: [
      {
        title: 'Purchase orders locked to budget codes',
        description: 'Every order is booked against a specific BOQ cost code. You see committed spending immediately before the vendor delivers.',
      },
      {
        title: 'Gate delivery verification',
        description: 'Site supervisors verify incoming trucks at the gate, upload weight slips and mill test certificates, and confirm quantities received.',
      },
      {
        title: 'Three-way matching before payment',
        description: 'Match the purchase order, the site delivery receipt, and the vendor invoice before finance releases payment.',
      },
    ],
    appPreviewDescription: 'Procurement pipeline tracking orders from purchase request through delivery receipt and invoice settlement.',
    sampleItems: [
      { code: 'PO-2026-88', title: 'Grade 60 Steel Rebar Batch (45 Tons)', meta: 'Delivered at Gate 2 • ASTM A615 verified', status: 'ontrack' },
      { code: 'PO-2026-92', title: 'Ready-Mix Concrete C35/45 (320 m³)', meta: 'Dispatched from plant • Slump testing required', status: 'ontrack' },
      { code: 'PO-2026-97', title: 'Structural PVC Drainage Conduits', meta: 'Pending vendor price confirmation', status: 'atrisk' },
    ],
    faqs: [
      {
        question: 'How do purchase orders prevent budget overruns?',
        answer: 'SiteFlow displays the remaining uncommitted budget for that cost code directly on the order screen. If an order exceeds budget, it flags for approval.',
      },
      {
        question: 'Can site teams upload delivery photos?',
        answer: 'Yes. Supervisors can snap photos of weighbridge slips, supplier delivery challans, and mill certificates directly from mobile devices.',
      },
      {
        question: 'Does this replace our accounting software?',
        answer: 'No. SiteFlow handles field procurement and cost authorization, then exports approved purchasing summaries to your accounting books.',
      },
    ],
    relatedSlugs: ['cost-control', 'field-logs', 'billing-and-payments'],
  },

  'field-logs': {
    slug: 'field-logs',
    title: 'Field Logs',
    badge: 'Daily Site Reporting',
    headline: 'Log manpower, weather, and site work in under two minutes',
    supportingSentence: 'Give site supervisors a fast phone screen to record worker headcounts, equipment hours, and daily progress without paperwork.',
    problem: 'At the end of a long day in the sun, site supervisors do not want to write lengthy paper journals. Crucial notes about subcontractor delays or inspection holds are forgotten until disputes occur months later.',
    benefits: [
      {
        title: 'Mobile-first field entry',
        description: 'Built for dusty screens and bright sunlight. Large touch targets let supervisors log headcount, weather, and activity in 120 seconds.',
      },
      {
        title: 'Daily photo journal with timestamps',
        description: 'Attach photos of slab preparation, rebar placement, and delivered batches with permanent date stamps and project tags.',
      },
      {
        title: 'Labor trade breakdown',
        description: 'Record steel fixers, masons, carpenters, and general helpers on site each day to track labor productivity against schedule.',
      },
    ],
    appPreviewDescription: 'Daily field log journal aggregating labor numbers, equipment hours, and inspection approvals into a searchable record.',
    sampleItems: [
      { code: 'LOG-OCT-12', title: 'Daily Report • 42 Workers on Site', meta: 'Weather: Clear 28°C • Slab 4 pour preparation complete', status: 'ontrack' },
      { code: 'LOG-OCT-11', title: 'Steel Inspection Sign-off (Tower B)', meta: 'Consultant approved rebar layout • 3 minor ties fixed', status: 'ontrack' },
      { code: 'LOG-OCT-10', title: 'Rain Delay & Power Outage Stoppage', meta: 'Generator fuel delivery delayed • 3 hours lost', status: 'delayed' },
    ],
    faqs: [
      {
        question: 'Does this work without mobile data on site?',
        answer: 'Yes. Supervisors can enter daily logs and take photos offline. The app syncs automatically as soon as their phone reconnects to cellular data or Wi-Fi.',
      },
      {
        question: 'Can the client see our daily logs?',
        answer: 'Only if you grant client view access. You can choose to share certified daily summaries or keep detailed internal labor notes private.',
      },
      {
        question: 'How do daily logs help with subcontractor disputes?',
        answer: 'Every log records how many trade workers were actually present on site each day, providing clear factual records if a trade claims they were delayed.',
      },
    ],
    relatedSlugs: ['scheduling', 'subcontractors', 'documents'],
  },

  subcontractors: {
    slug: 'subcontractors',
    title: 'Subcontractors',
    badge: 'Trade & Vendor Management',
    headline: 'Manage trade contracts and milestone sign-offs cleanly',
    supportingSentence: 'Give each subcontractor a dedicated portal to view awarded scopes, submit progress claims, and track retainage without exposing internal profits.',
    problem: 'Subcontractors submit handwritten bills that include items already paid in previous cycles. Without a shared ledger, contractors spend days in arguments trying to reconcile past payments and retainage deductions.',
    benefits: [
      {
        title: 'Dedicated trade portal',
        description: 'Subcontractors only see their contracted items, approved work quantities, and pending payment applications.',
      },
      {
        title: 'Cumulative payment history',
        description: 'Every payment certificate shows total contract value, previous payments, current claim, and retainage withheld.',
      },
      {
        title: 'Milestone sign-off workflow',
        description: 'The site supervisor inspects the work on site before the project manager approves the payment application.',
      },
    ],
    appPreviewDescription: 'Trade contractor directory tracking active subcontract agreements, certified work completion, and withheld retainage.',
    sampleItems: [
      { code: 'SC-STEEL-01', title: 'Al-Madina Steel Fixing Services', meta: 'Contract: PKR 14.5M • Certified: 68% • Retainage: 10%', status: 'ontrack' },
      { code: 'SC-CONC-04', title: 'Metro Pumping & Concrete Pouring', meta: 'Contract: PKR 28.0M • Certified: 52% • Retainage: 10%', status: 'ontrack' },
      { code: 'SC-MEP-02', title: 'Apex Electrical & Conduit Installers', meta: 'Contract: PKR 8.2M • Mobilization delayed by rain', status: 'atrisk' },
    ],
    faqs: [
      {
        question: 'Can subcontractors see my markup or profit margin?',
        answer: 'Never. Subcontractors only see their agreed unit rates and contract amounts. Internal company budgets and client pricing are completely hidden.',
      },
      {
        question: 'How does retainage work?',
        answer: 'SiteFlow automatically withholds the agreed retainage percentage (typically 5% or 10%) from each payment until the defect liability period expires.',
      },
      {
        question: 'Can we store trade compliance documents?',
        answer: 'Yes. You can upload contractor tax registration, insurance documents, and worker safety affidavits directly to their profile.',
      },
    ],
    relatedSlugs: ['billing-and-payments', 'change-orders', 'cost-control'],
  },

  'change-orders': {
    slug: 'change-orders',
    title: 'Change Orders',
    badge: 'Variation & Scope Changes',
    headline: 'Turn extra site requests into approved paid variations',
    supportingSentence: 'Record client design changes and unforeseen field conditions immediately so extra work never gets done for free.',
    problem: 'The client requests changes to partition walls or finishes during an informal site walk. The contractor builds it, but at handover the owner refuses to pay because no written variation was approved upfront.',
    benefits: [
      {
        title: 'Instant variation documentation',
        description: 'Log change requests directly from the site with description, cost breakdown, and photographic justification.',
      },
      {
        title: 'Clear approval workflow',
        description: 'Track change orders through draft, submitted, approved, or rejected states with date stamps and signature sign-offs.',
      },
      {
        title: 'Automatic budget adjustments',
        description: 'Approved variations update the contract value and cost forecast automatically, ensuring financial forecasts stay accurate.',
      },
    ],
    appPreviewDescription: 'Variation log tracking proposed scope adjustments, cost impacts, client approvals, and schedule adjustments.',
    sampleItems: [
      { code: 'CO-001', title: 'Additional Foundation Raft Piling Depth (+2.5m)', meta: 'Approved • Value: PKR 3,850,000 • +4 Days', status: 'ontrack' },
      { code: 'CO-002', title: '4th Floor Slab Layout Redesign for HVAC Ducts', meta: 'Pending Client Approval • Value: PKR 1,240,000', status: 'atrisk' },
      { code: 'CO-003', title: 'Upgraded Porcelain Tile Finishes in Lobby', meta: 'Drafting Specification • Value: PKR 890,000', status: 'ontrack' },
    ],
    faqs: [
      {
        question: 'Can clients approve change orders digitally?',
        answer: 'Yes. You can share a client approval link where the project owner reviews the cost breakdown and approves the variation with an audit log.',
      },
      {
        question: 'Does a change order update the baseline BOQ?',
        answer: 'Approved change orders create distinct revision line items so you can always compare the original baseline contract against the revised scope.',
      },
      {
        question: 'What if a change order also delays the project timeline?',
        answer: 'Each variation includes both a cost adjustment and an agreed time extension to protect your completion milestones.',
      },
    ],
    relatedSlugs: ['estimating-and-boq', 'cost-control', 'billing-and-payments'],
  },

  'cost-control': {
    slug: 'cost-control',
    title: 'Cost Control',
    badge: 'Real-time Budget Tracking',
    headline: 'Spot cost overruns while they happen, not after the job finishes',
    supportingSentence: 'Compare baseline budget, committed purchase orders, actual spent cash, and completion forecast in real time.',
    problem: 'Contractors discover project losses three months after completion when all supplier bills have finally arrived. By then, it is too late to negotiate rates or recover costs from subcontractors.',
    benefits: [
      {
        title: 'Four distinct money roles',
        description: 'Keep baseline budget, committed purchase orders, actual spent cash, and completion forecast strictly separated.',
      },
      {
        title: 'Live cost code variance',
        description: 'View costs by civil division or CSI code. Red and amber indicators flag line items running over budget before you commit more funds.',
      },
      {
        title: 'Profit margin protection',
        description: 'Real-time forecast reveals whether the project will finish at the target 18% margin or if material increases are eating your profit.',
      },
    ],
    appPreviewDescription: 'Cost dashboard showing real-time budget utilization, committed obligations, and projected completion margins.',
    sampleItems: [
      { code: 'DIV-03', title: 'Concrete & Steel Structural Works', meta: 'Budget: PKR 78.5M • Committed: 64.2M • Variance: +2.1%', status: 'ontrack' },
      { code: 'DIV-04', title: 'Masonry & Partition Walls', meta: 'Budget: PKR 24.0M • Committed: 23.8M • Variance: -1.4%', status: 'atrisk' },
      { code: 'DIV-09', title: 'Finishes, Plaster & Floor Screed', meta: 'Budget: PKR 32.0M • Committed: 10.2M • On Track', status: 'ontrack' },
    ],
    faqs: [
      {
        question: 'What is the difference between committed and actual costs?',
        answer: 'Committed cost is the total value of issued purchase orders and subcontracts. Actual cost is the cash that has actually been paid out through cleared checks or wire transfers.',
      },
      {
        question: 'Can I set maximum spending thresholds?',
        answer: 'Yes. You can require project manager approval before any order can be issued that exceeds 90% of a cost code budget.',
      },
      {
        question: 'Does SiteFlow calculate profit forecasts automatically?',
        answer: 'Yes. As daily field logs and material deliveries are entered, SiteFlow updates the projected cost at completion against the contracted client value.',
      },
    ],
    relatedSlugs: ['procurement', 'billing-and-payments', 'estimating-and-boq'],
  },

  'billing-and-payments': {
    slug: 'billing-and-payments',
    title: 'Billing & Payments',
    badge: 'Progress Claims & Retainage',
    headline: 'Create transparent payment applications that get approved faster',
    supportingSentence: 'Generate clear progress billing certificates with automatic deductions for advance payments, withholding taxes, and retainage.',
    problem: 'Preparing monthly progress invoices takes three days of manual formula checking in Excel. Clients reject claims because previous advance deductions or retainage percentages do not match prior billing certificates.',
    benefits: [
      {
        title: 'Automated progress claim calculations',
        description: 'Select certified completion percentages for each BOQ item. SiteFlow calculates current billing, previous payments, and remaining balance automatically.',
      },
      {
        title: 'Built-in retainage & tax deduction logic',
        description: 'Deduct contract retainage (5% or 10%) and local withholding taxes (PRA / FBR in Pakistan, state taxes in US) without manual calculations.',
      },
      {
        title: 'Print-ready PDF certificates',
        description: 'Generate standardized payment certificates with company branding, item breakdown, and signature boxes ready for consultant sign-off.',
      },
    ],
    appPreviewDescription: 'Billing application generator tracking gross work completed, statutory tax deductions, retainage, and net payable amounts.',
    sampleItems: [
      { code: 'IPC-04', title: 'Interim Payment Certificate #04 (Tower B)', meta: 'Gross: PKR 18,450,000 • Net Approved: PKR 15,682,500', status: 'ontrack' },
      { code: 'IPC-03', title: 'Interim Payment Certificate #03', meta: 'Cleared Bank Wire • Reference: HBL-981042', status: 'ontrack' },
      { code: 'RET-01', title: 'Accumulated Retainage Withholding Pool', meta: 'Total Withheld: PKR 7,425,000 • Release at Handover', status: 'ontrack' },
    ],
    faqs: [
      {
        question: 'Does this generate AIA-style G702/G703 payment forms?',
        answer: 'Yes. For US projects, billing certificates follow the standard AIA format showing contract sum, retainage, and continuation sheet line items.',
      },
      {
        question: 'Does it calculate Pakistani tax withholding (WHT)?',
        answer: 'Yes. For Pakistan projects, SiteFlow automatically applies the configured PRA/FBR withholding tax rates on services and goods invoices.',
      },
      {
        question: 'Can finance mark payments as settled?',
        answer: 'Yes. Finance users record check numbers, bank wire transaction IDs, and settlement dates to maintain a complete payment record.',
      },
    ],
    relatedSlugs: ['subcontractors', 'cost-control', 'change-orders'],
  },

  documents: {
    slug: 'documents',
    title: 'Documents',
    badge: 'Drawing & Submittal Archive',
    headline: 'Ensure site crews always build from the latest approved revision',
    supportingSentence: 'Store architectural drawings, engineer submittals, mill test certificates, and site photos in one organized project archive.',
    problem: 'Supervisors build rebar cages from revision 2 drawings printed last month, unaware that the structural engineer issued revision 3 last Tuesday. Reworking hardened concrete ruins project profit margins.',
    benefits: [
      {
        title: 'Version-controlled drawings',
        description: 'Ensure site teams always see the latest approved drawing set. Older revisions are clearly marked as superseded with warning badges.',
      },
      {
        title: 'Mobile access in the field',
        description: 'Supervisors can pull up structural blueprints and detail drawings directly on their phones or tablets while standing at the pour site.',
      },
      {
        title: 'Material mill certificate archive',
        description: 'Store steel mill reports, concrete 28-day cylinder crushing test certificates, and waterproof membrane warranties linked to specific batches.',
      },
    ],
    appPreviewDescription: 'Central project document repository organizing architectural sheets, engineering submittals, and material testing records.',
    sampleItems: [
      { code: 'DWG-STR-402', title: '4th Floor Slab Reinforcement & Beam Layout (Rev 3)', meta: 'Approved for Construction • Architect: Studio Arch', status: 'ontrack' },
      { code: 'CERT-MILL-88', title: 'ASTM A615 Grade 60 Mill Test Certificate', meta: 'Verified 45 Ton Batch • Tensile: 520 MPa', status: 'ontrack' },
      { code: 'TEST-CYL-28D', title: '28-Day Concrete Cylinder Compressive Strength Report', meta: 'Achieved 42.5 MPa (Specified: 35.0 MPa)', status: 'ontrack' },
    ],
    faqs: [
      {
        question: 'How do you prevent crews from using superseded drawings?',
        answer: 'When a new revision is uploaded, older drawings are automatically marked with a bold red superseded banner to prevent accidental use.',
      },
      {
        question: 'Can submittal documents be linked to purchase orders?',
        answer: 'Yes. You can link mill test certificates and slump test reports directly to the corresponding purchase order and delivery gate entry.',
      },
      {
        question: 'Is there a file size limit for PDF drawings?',
        answer: 'Standard architectural drawing PDFs and high-resolution site inspection photos upload smoothly with fast mobile document viewing.',
      },
    ],
    relatedSlugs: ['field-logs', 'estimating-and-boq', 'subcontractors'],
  },
};
