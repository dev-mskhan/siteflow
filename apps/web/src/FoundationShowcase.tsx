import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Input,
  Select,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
} from './components/ui';
import {
  Building2,
  HardHat,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import { formatMoney, formatDate } from './lib/format';

export function FoundationShowcase() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');
  const [demoLoading, setDemoLoading] = useState(false);
  const toast = useToast();

  const isUSD = currency === 'USD';

  return (
    <div className="min-h-screen bg-bg text-text p-4 sm:p-8 font-body">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Foundation Header */}
        <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-accent">
                Stage B Completed • Theme 1 Locked
              </span>
              <span className="text-xs text-text-subtle font-mono">Design A Foundation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text tracking-tight">
              SiteFlow Component Foundation
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-2xl">
              All shared UI components in <code className="text-accent font-mono">web/src/components/ui</code> are active. Strict rule compliance: zero hex colors in components, 100% theme tokens, all 4 data states supported.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrency(currency === 'PKR' ? 'USD' : 'PKR')}
            >
              Currency: {currency}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                toast.success('Payment application approved', 'Notification sent to finance team.');
              }}
            >
              Test toast
            </Button>
          </div>
        </div>

        {/* Component Showcase 1: Buttons */}
        <section className="space-y-3">
          <h2 className="text-sm font-heading font-bold text-text uppercase tracking-wider">
            1. Shared Buttons (No One-Offs)
          </h2>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={() => toast.success('Project saved', 'Gulberg Executive Heights baseline saved.')}
              >
                Save project
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast.info('Proposal sent', 'Subcontractor notified via email.')}
              >
                Send proposal
              </Button>
              <Button variant="outline">
                Watch how it works
              </Button>
              <Button variant="ghost">
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => toast.error('Work stopped', 'Hazard safety flag logged on Site 3.')}
              >
                Halt site work
              </Button>
              <Button
                variant="primary"
                isLoading={demoLoading}
                onClick={() => {
                  setDemoLoading(true);
                  setTimeout(() => setDemoLoading(false), 1500);
                }}
              >
                {demoLoading ? 'Processing...' : 'Approve payment'}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Component Showcase 2: Status Badges (Project Status Only) */}
        <section className="space-y-3">
          <h2 className="text-sm font-heading font-bold text-text uppercase tracking-wider">
            2. Project Status Badges (Green, Amber, Red Gated to Status)
          </h2>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge variant="ontrack" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                On track
              </Badge>
              <Badge variant="atrisk" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                At risk
              </Badge>
              <Badge variant="delayed" icon={<Clock className="w-3.5 h-3.5" />}>
                Delayed
              </Badge>
              <Badge variant="neutral">
                Draft baseline
              </Badge>
              <Badge variant="accent">
                Architectural amber
              </Badge>
            </CardContent>
          </Card>
        </section>

        {/* Component Showcase 3: Form Controls (Input & Select) */}
        <section className="space-y-3">
          <h2 className="text-sm font-heading font-bold text-text uppercase tracking-wider">
            3. Form Controls with Plain-Wording Errors
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <Input
                  label="Project Title"
                  hint="Official contract name"
                  placeholder="e.g. Gulberg Executive Heights"
                  defaultValue="Gulberg Executive Heights — Tower B"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Select
                  label="Contract Currency"
                  hint="Primary billing unit"
                  options={[
                    { value: 'PKR', label: 'Pakistani Rupee (PKR)' },
                    { value: 'USD', label: 'US Dollar (USD)' },
                  ]}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'PKR' | 'USD')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Input
                  label="Concrete Slump Test Result"
                  placeholder="e.g. 120 mm"
                  defaultValue="240 mm"
                  error="Slump exceeds maximum allowable specification (150 mm). Reject batch."
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Component Showcase 4: Clean Tables (No Gradients) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-heading font-bold text-text uppercase tracking-wider">
              4. Tabular BOQ Sheet (Clean Surface, Tabular Figures)
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add line item</span>
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cost Code & Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Rate</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <div className="font-heading font-semibold text-text">
                    Item 03.14.02 — High-Tensile Deformed Rebar (32mm)
                  </div>
                  <div className="text-xs text-text-muted">ASTM A615 Grade 60 mill certified</div>
                </TableCell>
                <TableCell className="text-right font-mono font-medium">45.0 Ton</TableCell>
                <TableCell className="text-right font-mono text-text-muted">
                  {formatMoney(isUSD ? 950 : 265000, currency)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-text">
                  {formatMoney(isUSD ? 42750 : 11925000, currency)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="ontrack">Delivered</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    Inspect batch
                  </Button>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <div className="font-heading font-semibold text-text">
                    Item 03.20.01 — Ready-Mix Concrete C35/45
                  </div>
                  <div className="text-xs text-text-muted">Raft foundation continuous pour</div>
                </TableCell>
                <TableCell className="text-right font-mono font-medium">320.0 m³</TableCell>
                <TableCell className="text-right font-mono text-text-muted">
                  {formatMoney(isUSD ? 135 : 37800, currency)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-text">
                  {formatMoney(isUSD ? 43200 : 12096000, currency)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="atrisk">Pouring today</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    View slump test
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* Component Showcase 5: Four Required States (Loading, Error, Empty, Success) */}
        <section className="space-y-3">
          <h2 className="text-sm font-heading font-bold text-text uppercase tracking-wider">
            5. Mandatory 4 Screen States Demo (Loading, Error, Empty, Success)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Loading State (Skeleton, Not a Spinner) */}
            <Card>
              <CardHeader>
                <CardTitle>State 1: Loading (Skeleton)</CardTitle>
                <CardDescription>Zero spinners. Fluid structural skeletons.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>

            {/* 2. Error State */}
            <Card>
              <CardHeader>
                <CardTitle>State 2: Error State</CardTitle>
                <CardDescription>Friendly 1-sentence explanation + action.</CardDescription>
              </CardHeader>
              <CardContent>
                <ErrorState
                  title="Could not load project schedule"
                  message="The network connection timed out on site. Check your mobile data and try again."
                  retryLabel="Try again"
                  onRetry={() => toast.info('Retrying connection...')}
                />
              </CardContent>
            </Card>

            {/* 3. Empty State */}
            <Card>
              <CardHeader>
                <CardTitle>State 3: Empty State</CardTitle>
                <CardDescription>Always guides the user what to do next.</CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="No payment applications yet"
                  description="When subcontractors finish milestone work, create your first payment certificate here."
                  actionLabel="Create payment application"
                  onAction={() => setIsModalOpen(true)}
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Modal Demo */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add Bill of Quantities Line Item"
          description="Enter the item code, description, quantity, and contract unit rate."
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsModalOpen(false);
                  toast.success('Line item added', 'BOQ updated and uncommitted balance recalculated.');
                }}
              >
                Save line item
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Item Code"
              placeholder="e.g. 03.14.05"
              defaultValue="03.14.05"
            />
            <Input
              label="Item Description"
              placeholder="e.g. Mild Steel Binding Wire (18 Gauge)"
              defaultValue="Mild Steel Binding Wire (18 Gauge)"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Estimated Quantity"
                placeholder="e.g. 500"
                defaultValue="500"
                rightAddon={<span className="text-xs font-mono">Kg</span>}
              />
              <Input
                label="Unit Rate"
                placeholder="e.g. 320"
                defaultValue="320"
                leftAddon={<span className="text-xs font-mono">{currency}</span>}
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
