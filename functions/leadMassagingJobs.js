const admin = require("firebase-admin");
const functions = require("firebase-functions");

// Collections used by the Lead Massaging tool
const COLLECTIONS = {
  leadLists: "lead-lists",
  leadListItems: "lead-list-items",
  leadMassageJobs: "lead-massage-jobs",
  leadMassageItemJobs: "lead-massage-item-jobs",
  generate: "generate",
};

/**
 * Safely read nested lead data fields (lead-list-items store user data under `data`)
 */
function getLeadFieldValue(leadData, key) {
  if (!leadData || typeof leadData !== "object") return "";
  const v = leadData[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function hasNonEmpty(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * Build the prompt that will be sent to the Gemini "generate" pipeline.
 * We keep this consistent with the admin UI expectations: concise output only.
 */
function buildLeadMassagePrompt({ lead, sourceColumns, instructionPrompt }) {
  const leadData = (lead && lead.data) || {};
  const normalizedCols = Array.isArray(sourceColumns) ? sourceColumns : [];

  const inputLines = normalizedCols.map((col) => {
    const value = getLeadFieldValue(leadData, col);
    return `${col}: "${value}"`;
  });

  return `Transform the following lead data according to the instructions.

LEAD DATA:
${inputLines.join("\n")}

INSTRUCTIONS:
${String(instructionPrompt || "").trim()}

RESPONSE RULES:
- Output ONLY the transformed text (no JSON, no quotes, no labels)
- Keep it concise (8-15 words if the prompt implies a hook)
- If input is empty or unclear, output an empty string`;
}

/**
 * Fan-out worker: when a batch job is created, enqueue one per-lead item job.
 * This avoids long-running Netlify functions and enables progressive updates.
 */
exports.onLeadMassageJobCreated = functions.firestore
  .document(`${COLLECTIONS.leadMassageJobs}/{jobId}`)
  .onCreate(async (snap, context) => {
    const jobId = context.params.jobId;
    const job = snap.data() || {};

    const listId = job.listId;
    const sourceColumns = job.sourceColumns || (job.sourceColumn ? [job.sourceColumn] : []);
    const newColumnName = job.newColumnName;
    const prompt = job.prompt;

    if (!listId || !Array.isArray(sourceColumns) || sourceColumns.length === 0 || !newColumnName || !prompt) {
      await snap.ref.set(
        {
          status: "failed",
          message: "Job missing required fields (listId, sourceColumns, newColumnName, prompt).",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          debug: {
            phase: "failed",
            lastError: "Missing required fields",
          },
        },
        { merge: true }
      );
      return;
    }

    // Mark running early (fan-out begins)
    await snap.ref.set(
      {
        status: "running",
        message: "Enqueuing per-lead jobs…",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        debug: {
          phase: "enqueue_start",
          jobId,
        },
      },
      { merge: true }
    );

    const db = admin.firestore();

    // Paginate through lead-list-items for this list.
    // We cannot reliably query for "missing data[newColumnName]" in Firestore, so we enqueue all items
    // and each item worker will safely skip if the target column already has a value.
    const PAGE_SIZE = 500;
    let lastDoc = null;
    let totalLeads = 0;

    while (true) {
      let q = db
        .collection(COLLECTIONS.leadListItems)
        .where("listId", "==", listId)
        .orderBy("createdAt", "asc")
        .limit(PAGE_SIZE);

      if (lastDoc) q = q.startAfter(lastDoc);

      const page = await q.get();
      if (page.empty) break;

      const batch = db.batch();
      page.docs.forEach((docSnap) => {
        totalLeads += 1;

        const itemJobId = `${jobId}__${docSnap.id}`;
        const itemJobRef = db.collection(COLLECTIONS.leadMassageItemJobs).doc(itemJobId);

        batch.set(
          itemJobRef,
          {
            id: itemJobId,
            jobId,
            listId,
            leadItemId: docSnap.id,
            sourceColumns,
            newColumnName,
            prompt,
            status: "queued",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      lastDoc = page.docs[page.docs.length - 1];
    }

    await snap.ref.set(
      {
        totalLeads,
        processedCount: 0,
        newlyProcessedCount: 0,
        alreadyProcessedCount: 0,
        remainingLeads: totalLeads,
        errorCount: 0,
        message: `Enqueued ${totalLeads.toLocaleString()} lead jobs. Processing…`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        debug: {
          phase: "enqueued",
          totalLeads,
        },
      },
      { merge: true }
    );
  });

/**
 * Item worker: when a per-lead item job is created, create a `generate` doc.
 * Another trigger (`onGenerateWriteForLeadMassage`) will apply output to the lead row.
 */
exports.onLeadMassageItemJobCreated = functions.firestore
  .document(`${COLLECTIONS.leadMassageItemJobs}/{itemJobId}`)
  .onCreate(async (snap, context) => {
    const itemJobId = context.params.itemJobId;
    const itemJob = snap.data() || {};

    const db = admin.firestore();

    // If the parent job is cancelled/failed, do nothing.
    const parentRef = db.collection(COLLECTIONS.leadMassageJobs).doc(itemJob.jobId);
    const parentSnap = await parentRef.get();
    const parent = parentSnap.data() || {};
    if (parent?.status === "cancelled" || parent?.status === "failed") {
      await snap.ref.set(
        {
          status: "cancelled",
          message: "Parent job cancelled/failed before processing started.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const leadItemId = itemJob.leadItemId;
    const listId = itemJob.listId;
    const newColumnName = itemJob.newColumnName;
    const sourceColumns = itemJob.sourceColumns || [];
    const instructionPrompt = itemJob.prompt || "";

    if (!leadItemId || !listId || !newColumnName) {
      await snap.ref.set(
        {
          status: "error",
          message: "Missing leadItemId/listId/newColumnName on item job.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const leadRef = db.collection(COLLECTIONS.leadListItems).doc(leadItemId);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
      await snap.ref.set(
        {
          status: "error",
          message: "Lead row not found.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const lead = leadSnap.data() || {};
    const existing = lead?.data?.[newColumnName];
    if (hasNonEmpty(existing)) {
      // Already filled; mark as alreadyProcessed without creating a generate doc.
      await snap.ref.set(
        {
          status: "skipped",
          message: "Target column already had a value; skipping.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await parentRef.set(
        {
          alreadyProcessedCount: admin.firestore.FieldValue.increment(1),
          processedCount: admin.firestore.FieldValue.increment(1),
          remainingLeads: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const prompt = buildLeadMassagePrompt({
      lead,
      sourceColumns,
      instructionPrompt,
    });

    const generateRef = await db.collection(COLLECTIONS.generate).add({
      prompt,
      // Metadata for our downstream trigger to know what to update
      leadMassage: {
        jobId: itemJob.jobId,
        itemJobId,
        listId,
        leadItemId,
        newColumnName,
        sourceColumns,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await snap.ref.set(
      {
        status: "processing",
        generateId: generateRef.id,
        message: "Sent to Gemini generate pipeline.",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

/**
 * Apply output: when the Gemini pipeline writes `output` on `generate/{id}` for a leadMassage request,
 * write the value into `lead-list-items/{leadItemId}.data[newColumnName]` and update progress counters.
 */
exports.onGenerateWriteForLeadMassage = functions.firestore
  .document(`${COLLECTIONS.generate}/{generateId}`)
  .onUpdate(async (change, context) => {
    const after = change.after.data() || {};
    const before = change.before.data() || {};

    // Only act when output becomes available (or changes from empty to non-empty)
    const afterOutput = after.output;
    const beforeOutput = before.output;
    if (!hasNonEmpty(afterOutput) || hasNonEmpty(beforeOutput)) return;

    const meta = after.leadMassage;
    if (!meta || !meta.jobId || !meta.itemJobId || !meta.leadItemId || !meta.newColumnName) return;

    const db = admin.firestore();
    const parentRef = db.collection(COLLECTIONS.leadMassageJobs).doc(meta.jobId);
    const itemJobRef = db.collection(COLLECTIONS.leadMassageItemJobs).doc(meta.itemJobId);
    const leadRef = db.collection(COLLECTIONS.leadListItems).doc(meta.leadItemId);

    // Respect cancellation
    const parentSnap = await parentRef.get();
    const parent = parentSnap.data() || {};
    if (parent?.status === "cancelled") {
      await itemJobRef.set(
        {
          status: "cancelled",
          message: "Parent job cancelled; output not applied.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    await db.runTransaction(async (tx) => {
      const leadSnap = await tx.get(leadRef);
      if (!leadSnap.exists) {
        tx.set(
          itemJobRef,
          {
            status: "error",
            message: "Lead row not found when applying output.",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        tx.set(
          parentRef,
          {
            errorCount: admin.firestore.FieldValue.increment(1),
            processedCount: admin.firestore.FieldValue.increment(1),
            remainingLeads: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return;
      }

      const lead = leadSnap.data() || {};
      const currentData = (lead.data && typeof lead.data === "object") ? lead.data : {};
      const existing = currentData[meta.newColumnName];

      // Only set if still empty to avoid stomping a user-edited value.
      if (!hasNonEmpty(existing)) {
        tx.set(
          leadRef,
          {
            data: {
              ...currentData,
              [meta.newColumnName]: String(afterOutput || "").trim(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // Optional status fields (non-breaking): keeps per-lead visibility without changing existing table behavior
            leadMassage: {
              ...(lead.leadMassage || {}),
              [meta.newColumnName]: {
                state: "done",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                generateId: context.params.generateId,
              },
            },
          },
          { merge: true }
        );

        tx.set(
          itemJobRef,
          {
            status: "done",
            output: String(afterOutput || "").trim(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        tx.set(
          parentRef,
          {
            newlyProcessedCount: admin.firestore.FieldValue.increment(1),
            processedCount: admin.firestore.FieldValue.increment(1),
            remainingLeads: admin.firestore.FieldValue.increment(-1),
            message: "Processing…",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        // Someone filled it in while we were generating
        tx.set(
          itemJobRef,
          {
            status: "skipped",
            message: "Target column filled before output applied; skipping.",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        tx.set(
          parentRef,
          {
            alreadyProcessedCount: admin.firestore.FieldValue.increment(1),
            processedCount: admin.firestore.FieldValue.increment(1),
            remainingLeads: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    });

    // If remaining hits 0, mark completed (best-effort; races are OK)
    try {
      const latestParent = await parentRef.get();
      const p = latestParent.data() || {};
      if (typeof p.remainingLeads === "number" && p.remainingLeads <= 0 && p.status !== "completed" && p.status !== "cancelled") {
        await parentRef.set(
          {
            status: "completed",
            message: `Completed. Updated ${Number(p.newlyProcessedCount || 0).toLocaleString()} new leads.`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            debug: { phase: "completed" },
          },
          { merge: true }
        );

        // Ensure the column exists in the lead list columns array (only if new)
        const listId = p.listId;
        const newColumnName = p.newColumnName;
        if (listId && newColumnName) {
          const listRef = db.collection(COLLECTIONS.leadLists).doc(listId);
          const listSnap = await listRef.get();
          const list = listSnap.data() || {};
          const columns = Array.isArray(list.columns) ? list.columns : [];
          if (!columns.includes(newColumnName)) {
            await listRef.set(
              {
                columns: [...columns, newColumnName],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } else {
            await listRef.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
          }
        }
      }
    } catch (e) {
      // Best-effort finalize; do not throw (avoid retries causing duplicate increments)
      console.error("[leadMassagingJobs] finalize error:", e);
    }
  });

