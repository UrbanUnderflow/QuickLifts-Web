const {hasCompletedRequiredConsents}=require('/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/accessState.ts');
const {selectConsentDocumentsForProduct,PARTICIPATION_CONSENT,consentDecisionComplete}=require('/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/consentPolicy.ts');
const doc=selectConsentDocumentsForProduct([PARTICIPATION_CONSENT],'pulsecheck')[0];
for(const completedConsentVersions of [{},{[doc.id]:'v1'}]) console.log(JSON.stringify({versionMap:completedConsentVersions,accessGate:hasCompletedRequiredConsents({requiredConsents:[doc],completedConsentIds:[doc.id],completedConsentVersions}),exactDecision:consentDecisionComplete(doc,{},[doc.id],completedConsentVersions)}));
