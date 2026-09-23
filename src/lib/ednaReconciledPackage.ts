import source from '../content/equity/edna-reconciled-package.json';
import {dateEdnaInstrument} from './ednaDocumentDate';

export const EDNA_PACKAGE_IDS = ['pil-auntedna-vesting-shares-draft', 'pil-auntedna-20260909-04', 'pil-auntedna-20260909-05', 'pil-auntedna-20260909-07'];

export function reconcileEdnaPackage(agreement: string) {
  if (!agreement.includes('3.5 Company option to repurchase at original cost.') || !agreement.includes('exactly 200,000 shares of PIL common stock')) throw new Error('Apply the settled vesting agreement before reconciling the package.');
  const content = dateEdnaInstrument(agreement)
    .replace(/Jelanna Salas Olivera/g, 'Jelanna Olivera')
    .replace(/September 11, 2026 Reciprocal Strategic Equity Side Letter/g, 'September 23, 2026 revised Reciprocal Strategic Equity Side Letter')
    .replace(/the September 11 Side Letter/g, 'the September 23 Side Letter')
    .replace(/The September 11 Side Letter/g, 'The September 23 Side Letter')
    .replace(/September 11, 2026 Side Letter/g, 'September 23, 2026 revised Side Letter')
    .replace('and Reciprocal Strategic Equity Side Letter (the “Side Letter”), including', 'and the revised Reciprocal Strategic Equity Side Letter dated September 23, 2026 (the “Side Letter”), including');
  const closing = ['Complete PIL board approval of consideration value, original acquisition cost per share, and the separate Warrant exercise price', 'Complete approved capitalization and reservation certificates and reciprocal EDNA award delivery, including the initial 2% condition', 'Confirm EDNA corporate identity and obtain all required signatures and corporate and securities approvals'];
  return [
    {id: EDNA_PACKAGE_IDS[0], title: 'PIL Strategic Vesting Share Agreement - EDNA, Inc.', content, requiresSignature: true, closingRequirements: closing, exhibits: [] as string[]},
    {id: EDNA_PACKAGE_IDS[1], title: 'Revised Reciprocal Strategic Equity Side Letter - September 23, 2026', content: source.sideLetter, requiresSignature: true, closingRequirements: closing, exhibits: [] as string[]},
    {id: EDNA_PACKAGE_IDS[2], title: 'PIL Board Consent - EDNA Strategic Equity - September 23, 2026', content: source.board, requiresSignature: true, closingRequirements: [] as string[], exhibits: [EDNA_PACKAGE_IDS[0], EDNA_PACKAGE_IDS[3], EDNA_PACKAGE_IDS[1]]},
    {id: EDNA_PACKAGE_IDS[3], title: 'PIL Strategic Partnership Warrant to EDNA, Inc. - September 23, 2026', content: source.warrant, requiresSignature: true, closingRequirements: closing, exhibits: [] as string[]},
  ];
}
