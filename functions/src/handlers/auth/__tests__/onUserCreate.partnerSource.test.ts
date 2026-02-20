import * as admin from "firebase-admin";
import * as functionsTest from "firebase-functions-test";

import { createUserDocument } from "../onUserCreate";
import { validatePartnerSource, isPartnerSourceImmutableUpdate } from "../../../validators/auth";
import { PartnerSource } from "../../../models/user";

const testEnv = functionsTest({}, {
  projectId: "quicklifts-partner-source-test",
});

describe("onUserCreate partnerSource handling", () => {
  beforeAll(() => {
    if (admin.apps.length === 0) {
      admin.initializeApp();
    }
  });

  afterAll(async () => {
    // Clean up any created documents
    const db = admin.firestore();
    const usersSnap = await db.collection("users").get();
    const batch = db.batch();
    usersSnap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    testEnv.cleanup();
  });

  it("persists a valid partnerSource object on user creation", async () => {
    const db = admin.firestore();

    const rawPartnerSource = { type: "brand", partnerId: "partner-123" };
    const validated = validatePartnerSource(rawPartnerSource) as PartnerSource;

    await createUserDocument({
      uid: "testUser-partner",
      email: "partner@example.com",
      displayName: "Partner User",
      username: "partner_user",
      partnerSource: validated,
    });

    const snap = await db.collection("users").doc("testUser-partner").get();
    expect(snap.exists).toBe(true);
    const data = snap.data() as any;

    expect(data.partnerSource).toEqual({
      type: "brand",
      partnerId: "partner-123",
    });
  });

  it("rejects invalid partnerSource payloads via validator", () => {
    expect(validatePartnerSource(null)).toBeUndefined();
    expect(validatePartnerSource({})).toBeUndefined();
    expect(validatePartnerSource({ type: "unknown", partnerId: "x" })).toBeUndefined();
    expect(validatePartnerSource({ type: "brand", partnerId: "" })).toBeUndefined();
  });

  it("treats partnerSource as immutable for subsequent updates", () => {
    const original: PartnerSource = { type: "gym", partnerId: "gym-abc" };

    // Same value -> allowed
    expect(
      isPartnerSourceImmutableUpdate(original, { type: "gym", partnerId: "gym-abc" })
    ).toBe(true);

    // Attempt to change type -> not allowed
    expect(
      isPartnerSourceImmutableUpdate(original, { type: "brand", partnerId: "gym-abc" })
    ).toBe(false);

    // Attempt to change partnerId -> not allowed
    expect(
      isPartnerSourceImmutableUpdate(original, { type: "gym", partnerId: "other" })
    ).toBe(false);

    // Attempt to add partnerSource where none existed -> not allowed
    expect(isPartnerSourceImmutableUpdate(undefined, original)).toBe(false);

    // Attempt to remove partnerSource -> not allowed
    expect(isPartnerSourceImmutableUpdate(original, undefined)).toBe(false);
  });
});
