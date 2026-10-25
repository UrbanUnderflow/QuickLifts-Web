import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { APP_VERSION_PRODUCT_CONFIGS, type AppVersionProduct } from '../../../utils/appVersioning';
import { type InAppMessageContent, validateInAppMessage } from '../../../utils/inAppMessages';

/** Highlight edits never re-publish a release or replace its media and metadata. */
export async function savePublishedReleaseHighlights(product: AppVersionProduct, version: string, content: InAppMessageContent) {
  if (!version.trim() || version.includes('/')) throw Error('Choose an existing release before editing its highlights.');
  const whatsNew=validateInAppMessage(content);
  const references=APP_VERSION_PRODUCT_CONFIGS[product].versionCollections.map(name=>doc(db,name,version));
  await runTransaction(db,async transaction=>{
    const snapshots=await Promise.all(references.map(reference=>transaction.get(reference)));
    const existing=snapshots.map((snapshot,index)=>({snapshot,reference:references[index]})).filter(({snapshot})=>snapshot.exists());
    if (!existing.length) throw Error('This release no longer exists. Reload the published release before saving.');
    for (const {reference} of existing) transaction.update(reference,{whatsNew,updatedAt:serverTimestamp()});
  });
}
