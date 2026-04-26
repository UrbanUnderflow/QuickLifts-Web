// Compatibility entrypoint for Slice 1 workers that imported the singular
// service filename. The implementation lives in pulsecheckCoachReports.ts so
// the schema, language audit gate, and Firestore guardrails stay in one place.
export * from './pulsecheckCoachReports';
