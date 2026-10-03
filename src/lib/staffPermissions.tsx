import type { ElementType } from 'react';
import { BarChart3, ClipboardList, HeartPulse, ShieldCheck } from 'lucide-react';
import type { StaffPermission } from '../api/firebase/pulsecheckProvisioning/types';

// Canonical staff/admin capability options, shared across every place a coach (or
// we, at provisioning) assigns access: the dashboard "Invite a staff member"
// modal, the coach-onboarding staff step, and the admin onboarding modal. Keep
// this the single source so the surfaces stay in lockstep.
export type StaffPermissionOption = {
  key: StaffPermission;
  label: string;
  blurb: string;
  icon: ElementType;
};

export const STAFF_PERMISSIONS: StaffPermissionOption[] = [
  { key: 'admin', label: 'Admin', blurb: 'Manage the team, invite staff, and assign permissions. Trainer summaries require the Athletic Trainer permission.', icon: ShieldCheck },
  { key: 'administrative', label: 'Manager', blurb: 'Update the schedule and train Nora', icon: ClipboardList },
  { key: 'coaching', label: 'Coaching', blurb: 'Participation, skill training, team messages, and reports', icon: BarChart3 },
  { key: 'athletic_trainer', label: 'Athletic Trainer', blurb: 'Consented team wellbeing and recovery summaries. Journal activity only, never entry text.', icon: HeartPulse },
];
