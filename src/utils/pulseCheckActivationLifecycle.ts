const PULSECHECK_PRE_ACTIVATION_PARENT_STATUSES = new Set([
  'draft',
  'provisioning',
  'ready-for-activation',
]);

export const isPulseCheckParentAwaitingActivation = (status: unknown): boolean => {
  const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return PULSECHECK_PRE_ACTIVATION_PARENT_STATUSES.has(normalizedStatus);
};

export const shouldAdvancePulseCheckParentToReadyForActivation = isPulseCheckParentAwaitingActivation;
