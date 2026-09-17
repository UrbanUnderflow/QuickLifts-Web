// Companies available for document generation
export const COMPANIES = [
  { id: 'pulse', name: 'Pulse Intelligence Labs, Inc.' },
  { id: 'tres', name: 'TresProperties LLC' },
  { id: 'edna', name: 'EDNA, inc DBA: auntEDNA.ai' },
];

// Wire transfer instructions keyed by company
export const WIRE_INSTRUCTIONS: Record<string, {
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  accountType?: string;
  beneficiaryName: string;
  beneficiaryAddress?: string;
  swift?: string;
  bankAddress?: string;
  intermediarySwift?: string;
  note?: string;
}> = {
  'Pulse Intelligence Labs, Inc.': {
    bankName: 'Column N.A. (via Mercury)',
    routingNumber: '121145433',
    accountNumber: '118879863125743',
    accountType: 'Checking',
    beneficiaryName: 'Pulse Intelligence Labs, Inc.',
    beneficiaryAddress: '1111B S Governors Ave, STE 50759, Dover, DE 19904',
    bankAddress: '1 Letterman Drive, Building A, Suite A4-700, San Francisco, CA 94129',
    swift: 'CLNOUS66MER',
    intermediarySwift: 'CHASUS33XXX',
    note: 'For international wires use SWIFT: CLNOUS66MER. Intermediary bank SWIFT: CHASUS33XXX.',
  },
  'EDNA, inc DBA: auntEDNA.ai': {
    bankName: 'Column N.A. (via Mercury)',
    routingNumber: '121145433',
    accountNumber: '244192504752325',
    beneficiaryName: 'EDNA, inc DBA: auntEDNA.ai',
    beneficiaryAddress: '4 Mayfair Circle, Oxford, MA 01540',
    bankAddress: '1 Letterman Drive, Building A, Suite A4-700, San Francisco, CA 94129',
  },
  'TresProperties LLC': {
    bankName: 'JPMorgan Chase Bank, N.A.',
    routingNumber: '021000021',
    accountNumber: '888397715',
    accountType: 'Checking',
    beneficiaryName: 'TresProperties LLC',
    bankAddress: '383 Madison Avenue\nNew York, NY 10179',
    note: 'Routing number 021000021 applies to both ACH/direct deposit and wire transfers.',
  },
};

