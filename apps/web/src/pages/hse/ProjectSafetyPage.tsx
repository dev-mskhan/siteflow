/**
 * ProjectSafetyPage — /org/:orgId/projects/:projectId/safety
 * Tabs: Events | Meetings
 * Safety events: REPORTED → UNDER_INVESTIGATION (investigate) → CLOSED (close)
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { NavLink, Outlet } from 'react-router-dom';
import { Plus, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListSafetyEventsQuery, useCreateSafetyEventMutation, useTransitionSafetyEventMutation,
  useListSafetyMeetingsQuery, useCreateSafetyMeetingMutation,
} from '../../features/project/hseApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { SafetyEventStatus, SafetyEventType, SafetySeverity } from '../../types/hseTypes';

const STATUS_BADGE: Record<SafetyEventStatus, string> = {
  REPORTED:                      'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  UNDER_INVESTIGATION:            'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  CORRECTIVE_ACTION_REQUIRED:     'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  CORRECTIVE_ACTION_IN_PROGRESS:  'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  CLOSED:                         'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
};
const SEVERITY_BADGE: Record<SafetySeverity, string> = {
  LOW: 'text-[var(--muted)]', MEDIUM: 'text-[#92400e]', HIGH: 'text-[#991b1b]', CRITICAL: 'text-[#991b1b] font-bold', FATALITY: 'text-[#991b1b] font-bold uppercase',
};
const EVENT_TYPES: SafetyEventType[] = ['INCIDENT', 'NEAR_MISS', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'FIRST_AID'];
const SEVERITIES: SafetySeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATALITY'];

const Tab: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button type="button" onClick={onClick}
    className={`px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${active ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
    {label}
  </button>
);

export const ProjectSafetyPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canReport  = usePermission('project.safety.report');
  const canManage  = usePermission('project.safety.manage');
  const canInvest  = usePermission('project.safety.investigate');

  const [tab, setTab] = useState<'events' | 'meetings'>('events');
  const [showCreate, setShowCreate] = useState(false);
  const [showMtgCreate, setShowMtgCreate] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeNotes, setCloseNotes] = useState('');

  // Event form
  const [evType, setEvType]       = useState<SafetyEventType>('NEAR_MISS');
  const [evTitle, setEvTitle]     = useState('');
  const [evDesc, setEvDesc]       = useState('');
  const [evOccurred, setEvOccurred] = useState(new Date().toISOString().slice(0, 16));
  const [evSeverity, setEvSeverity] = useState<SafetySeverity>('MEDIUM');
  const [evLocation, setEvLocation] = useState('');
  const [evImmediate, setEvImmediate] = useState('');

  // Meeting form
  const [mtgTitle, setMtgTitle]   = useState('');
  const [mtgType, setMtgType]     = useState('Toolbox Talk');
  const [mtgAt, setMtgAt]         = useState(new Date().toISOString().slice(0, 16));
  const [mtgLoc, setMtgLoc]       = useState('');
  const [mtgAttendees, setMtgAttendees] = useState('');
  const [mtgAgenda, setMtgAgenda] = useState('');

  const { data: evData, isLoading } = useListSafetyEventsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: mtgData }           = useListSafetyMeetingsQuery({ orgId: orgId!, projectId: projectId! });
  const [createEvent, { isLoading: creating }]   = useCreateSafetyEventMutation();
  const [createMeeting, { isLoading: crMtg }]    = useCreateSafetyMeetingMutation();
  const [transition, { isLoading: transitioning }] = useTransitionSafetyEventMutation();

  const onCreate = async () => {
    if (!evTitle.trim() || !evDesc.trim()) { toastErr('Title and description required', ''); return; }
    try {
      await createEvent({ orgId: orgId!, projectId: projectId!, input: { eventType: evType, title: evTitle.trim(), description: evDesc.trim(), occurredAt: new Date(evOccurred).toISOString(), severity: evSeverity, location: evLocation.trim() || undefined, immediateAction: evImmediate.trim() || undefined } }).unwrap();
      toastOk('Safety event reported', '');
      setShowCreate(false); setEvTitle(''); setEvDesc(''); setEvLocation(''); setEvImmediate('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const onCreateMeeting = async () => {
    if (!mtgTitle.trim()) { toastErr('Title required', ''); return; }
    try {
      await createMeeting({ orgId: orgId!, projectId: projectId!, input: { meetingType: mtgType, title: mtgTitle.trim(), scheduledAt: new Date(mtgAt).toISOString(), attendeeCount: mtgAttendees ? parseInt(mtgAttendees) : undefined, notes: [mtgLoc.trim() && `Location: ${mtgLoc.trim()}`, mtgAgenda.trim() && `Agenda: ${mtgAgenda.trim()}`].filter(Boolean).join('\n') || undefined } }).unwrap();
      toastOk('Meeting recorded', '');
      setShowMtgCreate(false); setMtgTitle(''); setMtgAgenda(''); setMtgLoc(''); setMtgAttendees('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (eventId: string, action: 'investigate' | 'close') => {
    try {
      await transition({ orgId: orgId!, projectId: projectId!, eventId, action, notes: action === 'close' ? closeNotes : undefined }).unwrap();
      toastOk(action === 'close' ? 'Event closed' : 'Investigation started', '');
      setClosingId(null); setCloseNotes('');
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const events   = evData?.data ?? [];
  const meetings = mtgData?.data ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Safety</h2>
        {tab === 'events' && canReport && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" strokeWidth={2} /> Report event
          </button>
        )}
        {tab === 'meetings' && canManage && !showMtgCreate && (
          <button type="button" onClick={() => setShowMtgCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" strokeWidth={2} /> Record meeting
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        <Tab label="Events" active={tab === 'events'} onClick={() => setTab('events')} />
        <Tab label="Meetings" active={tab === 'meetings'} onClick={() => setTab('meetings')} />
      </div>

      {/* EVENTS TAB */}
      {tab === 'events' && (
        <>
          {showCreate && (
            <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Report safety event</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Type</label>
                  <select value={evType} onChange={(e) => setEvType(e.target.value as SafetyEventType)} className={inputCls()}>
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Severity</label>
                  <select value={evSeverity} onChange={(e) => setEvSeverity(e.target.value as SafetySeverity)} className={inputCls()}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Occurred at</label>
                  <input type="datetime-local" value={evOccurred} onChange={(e) => setEvOccurred(e.target.value)} className={inputCls()} />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
                  <input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} maxLength={500} className={inputCls()} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description *</label>
                  <textarea value={evDesc} onChange={(e) => setEvDesc(e.target.value)} rows={3} maxLength={10000} className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Location</label>
                  <input value={evLocation} onChange={(e) => setEvLocation(e.target.value)} maxLength={500} className={inputCls()} />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Immediate action taken</label>
                  <input value={evImmediate} onChange={(e) => setEvImmediate(e.target.value)} maxLength={5000} className={inputCls()} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
                <button onClick={onCreate} disabled={creating} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{creating ? 'Reporting…' : 'Report event'}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
              </div>
            </div>
          )}

          {closingId && (
            <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 flex items-center gap-3">
              <input type="text" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Closing notes (optional)" className="flex-1 border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2 text-sm" />
              <button onClick={() => doTransition(closingId, 'close')} disabled={transitioning} className="font-mono text-[9px] uppercase bg-[#166534] text-white px-4 py-1.5 disabled:opacity-50">Confirm close</button>
              <button type="button" onClick={() => setClosingId(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">✕</button>
            </div>
          )}

          <div className="border border-[var(--hairline-2)]">
            <div className="grid grid-cols-[2fr_100px_90px_100px_160px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              {['Title', 'Type', 'Severity', 'Status', ''].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
              ))}
            </div>
            {isLoading ? [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
            events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]">
                <ShieldAlert className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
                <p className="text-sm text-[var(--muted)]">No safety events reported.</p>
              </div>
            ) : events.map((ev) => (
              <div key={ev.id} className="grid grid-cols-[2fr_100px_90px_100px_160px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ev.title}</p>
                  {ev.location && <p className="font-mono text-[9px] text-[var(--muted)] truncate">{ev.location}</p>}
                </div>
                <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{ev.eventType.replace('_', ' ')}</p>
                <p className={cn('font-mono text-[9px] uppercase', ev.severity ? SEVERITY_BADGE[ev.severity] : 'text-[var(--muted)]')}>{ev.severity ?? '—'}</p>
                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[ev.status]}`}>
                  {ev.status.replace(/_/g, ' ')}
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {ev.status === 'REPORTED' && canInvest && (
                    <button onClick={() => doTransition(ev.id, 'investigate')} disabled={transitioning}
                      className="font-mono text-[8px] uppercase border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] px-1.5 py-0.5 hover:bg-[#dbeafe] disabled:opacity-50">Investigate</button>
                  )}
                  {['UNDER_INVESTIGATION', 'CORRECTIVE_ACTION_REQUIRED', 'CORRECTIVE_ACTION_IN_PROGRESS'].includes(ev.status) && canManage && (
                    <button onClick={() => setClosingId(ev.id)}
                      className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7]">Close</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MEETINGS TAB */}
      {tab === 'meetings' && (
        <>
          {showMtgCreate && (
            <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Record safety meeting</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Meeting type</label>
                  <select value={mtgType} onChange={(e) => setMtgType(e.target.value)} className={inputCls()}>
                    {['Toolbox Talk', 'Pre-task Brief', 'Safety Inspection', 'Incident Review', 'Weekly HSE Meeting'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
                  <input value={mtgTitle} onChange={(e) => setMtgTitle(e.target.value)} maxLength={500} className={inputCls()} />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scheduled at</label>
                  <input type="datetime-local" value={mtgAt} onChange={(e) => setMtgAt(e.target.value)} className={inputCls()} />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Location</label>
                  <input value={mtgLoc} onChange={(e) => setMtgLoc(e.target.value)} maxLength={500} className={inputCls()} />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Attendee count</label>
                  <input type="number" value={mtgAttendees} onChange={(e) => setMtgAttendees(e.target.value)} min={1} className={inputCls()} />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Agenda</label>
                  <textarea value={mtgAgenda} onChange={(e) => setMtgAgenda(e.target.value)} rows={2} className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
                <button onClick={onCreateMeeting} disabled={crMtg} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{crMtg ? 'Saving…' : 'Record meeting'}</button>
                <button type="button" onClick={() => setShowMtgCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
              </div>
            </div>
          )}
          {meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
              <p className="text-sm text-[var(--muted)]">No safety meetings recorded.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <div key={m.id} className="border border-[var(--hairline-2)] bg-[var(--paper)] px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="font-mono text-[9px] uppercase text-[var(--muted)] mt-0.5">{m.meetingType}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] text-[var(--muted)]">{new Date(m.scheduledAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      {m.attendeeCount != null && <p className="font-mono text-[9px] text-[var(--muted)]">{m.attendeeCount} attendees</p>}
                    </div>
                  </div>
                  {m.agenda && <p className="text-sm text-[var(--muted)] mt-2">{m.agenda}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
