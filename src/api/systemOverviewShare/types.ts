export interface SystemOverviewShareLink {
  token: string;
  sectionId: string;
  systemId: string;
  sectionLabel: string;
  sectionDescription?: string;
  snapshotText: string;
  /** Rendered HTML of the section at share time; shared page renders this verbatim when present. */
  snapshotHtml?: string;
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
  snapshotHtml?: string;
  passcode?: string;
}
