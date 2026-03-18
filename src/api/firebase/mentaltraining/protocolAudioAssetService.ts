import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config';
import { SIM_AUDIO_ASSETS_COLLECTION } from './collections';
import type { SimAudioAssetRef } from './audioAssetService';

const signatureCueCache = new Map<string, Promise<SimAudioAssetRef | null>>();

async function fetchProtocolSignatureCue(protocolId: string): Promise<SimAudioAssetRef | null> {
  const normalizedProtocolId = protocolId.trim();
  if (!normalizedProtocolId) return null;

  const cueKey = `${normalizedProtocolId}-signature`;
  const snapshot = await getDocs(
    query(
      collection(db, SIM_AUDIO_ASSETS_COLLECTION),
      where('cueKey', '==', cueKey),
      limit(1)
    )
  );

  const docSnap = snapshot.docs[0];
  if (!docSnap) return null;
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<SimAudioAssetRef, 'id'>),
  };
}

export const protocolAudioAssetService = {
  async getSignatureCue(protocolId?: string | null): Promise<SimAudioAssetRef | null> {
    const normalizedProtocolId = protocolId?.trim();
    if (!normalizedProtocolId) return null;

    const cached = signatureCueCache.get(normalizedProtocolId);
    if (cached) {
      return cached;
    }

    const request = fetchProtocolSignatureCue(normalizedProtocolId)
      .catch((error) => {
        signatureCueCache.delete(normalizedProtocolId);
        throw error;
      });
    signatureCueCache.set(normalizedProtocolId, request);
    return request;
  },

  clearSignatureCue(protocolId?: string | null) {
    const normalizedProtocolId = protocolId?.trim();
    if (!normalizedProtocolId) return;
    signatureCueCache.delete(normalizedProtocolId);
  },
};
