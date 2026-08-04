import type { Handler } from '@netlify/functions';
import { admin, getFirebaseAdminApp } from './config/firebase';
import { signingRequestCanAccessEquityDocument } from '../../src/lib/equityDocumentPreview';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

const serializeDate = (value: any): string | null => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
};

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  const documentId = String(event.queryStringParameters?.documentId || '').trim();
  const requestId = String(event.queryStringParameters?.requestId || '').trim();
  if (!documentId || !requestId) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Missing document preview parameters.' }),
    };
  }

  try {
    const firebaseApp = getFirebaseAdminApp(event);
    const firestore = admin.firestore(firebaseApp);
    const signingRequestSnapshot = await firestore.collection('signingRequests').doc(requestId).get();
    if (!signingRequestSnapshot.exists) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'Preview request not found.' }),
      };
    }

    const signingRequest = signingRequestSnapshot.data();
    if (!signingRequestCanAccessEquityDocument(signingRequest, documentId)) {
      return {
        statusCode: 403,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'This signing request does not include the requested document.' }),
      };
    }

    const equityDocumentSnapshot = await firestore.collection('equity-documents').doc(documentId).get();
    if (!equityDocumentSnapshot.exists) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'Document not found.' }),
      };
    }

    const data = equityDocumentSnapshot.data() || {};
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        document: {
          id: equityDocumentSnapshot.id,
          title: String(data.title || 'Equity Document'),
          content: String(data.content || ''),
          documentType: String(data.documentType || 'equity_document'),
          createdAt: serializeDate(data.createdAt || data.updatedAt),
          requiresSignature: Boolean(data.requiresSignature),
          autoSigned: Boolean(data.autoSigned || data.autoSignedAt),
        },
      }),
    };
  } catch (error) {
    console.error('get-equity-document-preview error', error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Unable to load this document preview.' }),
    };
  }
};

