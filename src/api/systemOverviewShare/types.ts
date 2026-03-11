export interface SystemOverviewShareLink {
  token: string;
  sectionId: string;
  systemId: string;
  sectionLabel: string;
  sectionDescription?: string;
  snapshotText: string;
  passcodeProtected?: boolean;
  createdByEmail?: string;
  createdAt?: string | null;
  revokedAt?: string | null;
  shareUrl: string;
}

export interface CreateSystemOverviewShareLinkInput {
  sectionId: string;
  systemId: string;
  sectionLabel: string;
  sectionDescription?: string;
  snapshotText: string;
  passcode?: string;
}
