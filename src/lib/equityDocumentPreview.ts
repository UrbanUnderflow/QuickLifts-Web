export interface EquitySupportingDocumentReference {
  id?: string;
  url?: string;
}

export interface EquitySigningRequestReference {
  invalidatedAt?: unknown;
  supportingDocuments?: EquitySupportingDocumentReference[];
}

export const buildScopedEquityDocumentUrl = (
  origin: string,
  documentId: string,
  signingRequestId: string,
) =>
  `${origin.replace(/\/+$/, '')}/equity-doc/${encodeURIComponent(documentId)}?requestId=${encodeURIComponent(signingRequestId)}`;

export const signingRequestCanAccessEquityDocument = (
  signingRequest: EquitySigningRequestReference | null | undefined,
  documentId: string,
) =>
  Boolean(
    signingRequest &&
      !signingRequest.invalidatedAt &&
      Array.isArray(signingRequest.supportingDocuments) &&
      signingRequest.supportingDocuments.some(document => document?.id === documentId),
  );

