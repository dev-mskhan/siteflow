import { useState } from 'react';
import { PageHeader } from '../../../components/shared/PageHeader';
import { DataTable, type Column } from '../../../components/shared/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { formatCurrency, formatDate } from '../../../lib/utils/index';
import { useToast } from '../../../components/ui/Toast';

interface ProjectRow {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'DRAFT';
  type: string;
  contractValue: number;
  currency: 'USD' | 'PKR';
  completion: number;
  updatedAt: string;
}

const initialProjects: ProjectRow[] = [
  {
    id: 'prj-001',
    name: 'Apex Heights Commercial Tower',
    code: 'AH-2026',
    status: 'ACTIVE',
    type: 'COMMERCIAL',
    contractValue: 4250000,
    currency: 'USD',
    completion: 64,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prj-002',
    name: 'Islamabad Expressway Flyover & Underpass',
    code: 'IE-EXP-04',
    status: 'ACTIVE',
    type: 'INFRASTRUCTURE',
    contractValue: 850000000,
    currency: 'PKR',
    completion: 41,
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'prj-003',
    name: 'Westside Logistics Distribution Hub',
    code: 'WL-HUB',
    status: 'ON_HOLD',
    type: 'INDUSTRIAL',
    contractValue: 1890000,
    currency: 'USD',
    completion: 18,
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'prj-004',
    name: 'Margalla Ridge Luxury Villas (Phase 2)',
    code: 'MR-VIL-02',
    status: 'DRAFT',
    type: 'RESIDENTIAL',
    contractValue: 420000000,
    currency: 'PKR',
    completion: 5,
    updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];

export default function ProjectsPage() {
  const { success: toastSuccess } = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    code: '',
    type: 'COMMERCIAL',
    contractValue: '',
    currency: 'USD' as 'USD' | 'PKR',
  });

  const columns: Column<ProjectRow>[] = [
    {
      key: 'name',
      header: 'Project Name & Code',
      render: (p) => (
        <div>
          <div className="font-bold text-text hover:text-accent-1 transition-colors">{p.name}</div>
          <div className="text-xs font-mono text-text-dim">{p.code} • {p.type}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge variant={p.status === 'ACTIVE' ? 'active' : p.status === 'ON_HOLD' ? 'warning' : 'draft'}>
          {p.status}
        </Badge>
      ),
    },
    {
      key: 'contractValue',
      header: 'Contract Value',
      isNumeric: true,
      render: (p) => (
        <span className="font-mono font-semibold">
          {formatCurrency(p.contractValue, p.currency)}
        </span>
      ),
    },
    {
      key: 'completion',
      header: 'Progress',
      render: (p) => (
        <div className="w-32 flex items-center gap-2">
          <div className="flex-1 bg-surface-2 rounded-full h-1.5 overflow-hidden border border-border">
            <div
              className="bg-accent-1 h-full rounded-full"
              style={{ width: `${p.completion}%`, background: 'var(--gradient-brand)' }}
            />
          </div>
          <span className="text-xs font-mono text-text-muted">{p.completion}%</span>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Modified',
      render: (p) => <span className="text-xs text-text-muted">{formatDate(p.updatedAt)}</span>,
    },
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;

    const created: ProjectRow = {
      id: `prj-${Date.now()}`,
      name: newProject.name,
      code: newProject.code || `PRJ-${Math.floor(Math.random() * 900 + 100)}`,
      status: 'ACTIVE',
      type: newProject.type,
      contractValue: Number(newProject.contractValue) || 1000000,
      currency: newProject.currency,
      completion: 0,
      updatedAt: new Date().toISOString(),
    };

    setProjects([created, ...projects]);
    setIsCreateOpen(false);
    toastSuccess('Project Created', `${created.name} is now ready for estimating and scheduling.`);
    setNewProject({ name: '', code: '', type: 'COMMERCIAL', contractValue: '', currency: 'USD' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Portfolio"
        description="Monitor budgets, active phases, critical path milestones, and contracts."
        actions={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            + Create New Project
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={projects}
        searchKey="name"
        searchPlaceholder="Filter projects by title..."
      />

      {/* Create Project Modal Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
        description="Initialize a new jobsite for estimating, BOQ generation, and field execution."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Project Name"
            required
            placeholder="e.g. Skyline Medical Tower Phase 1"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Project Code"
              placeholder="e.g. SMT-01"
              value={newProject.code}
              onChange={(e) => setNewProject({ ...newProject, code: e.target.value })}
            />

            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Project Type
              </label>
              <select
                value={newProject.type}
                onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-surface text-text border border-border outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <option value="COMMERCIAL">COMMERCIAL</option>
                <option value="RESIDENTIAL">RESIDENTIAL</option>
                <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                <option value="INDUSTRIAL">INDUSTRIAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estimated Contract Value"
              type="number"
              placeholder="e.g. 5000000"
              value={newProject.contractValue}
              onChange={(e) => setNewProject({ ...newProject, contractValue: e.target.value })}
            />

            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Currency
              </label>
              <select
                value={newProject.currency}
                onChange={(e) => setNewProject({ ...newProject, currency: e.target.value as 'USD' | 'PKR' })}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-surface text-text border border-border outline-none font-mono"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <option value="USD">USD ($)</option>
                <option value="PKR">PKR (Rs.)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border mt-4">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Initialize Project
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
