import partnerPlaybookConfig from "../../config/partnerPlaybook.json";

export type PartnerPlaybookType = "brand" | "gym" | "runClub";

export interface PartnerPlaybookStep {
  id: string;
  label: string;
  route: string;
}

export interface PartnerPlaybook {
  type: PartnerPlaybookType;
  label: string;
  steps: PartnerPlaybookStep[];
}

export type PartnerPlaybookConfig = Record<PartnerPlaybookType, PartnerPlaybook>;

const config = partnerPlaybookConfig as PartnerPlaybookConfig;

export function getPlaybookForType(type: PartnerPlaybookType): PartnerPlaybook {
  const playbook = config[type];
  if (!playbook) {
    throw new Error(`No partner playbook configured for type: ${type}`);
  }
  return playbook;
}

export function getPartnerPlaybookConfig(): PartnerPlaybookConfig {
  return config;
}
