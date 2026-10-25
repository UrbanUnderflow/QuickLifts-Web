# Remote app announcements and release highlights

The controls live in `/admin/addVersion`. Select PulseCheck or AthleticMind. Fit With Pulse and Macra retain their existing release-management behavior.

## Independent announcements

The announcement editor keeps drafts in the browser until Publish. Publishing writes the public message to `company-config/{appIdentity}-in-app-announcement`:

- `isEnabled`, `id`, and `revision`
- `title`, `markdown`, optional `actionLabel` and `actionURL`
- `audience`: `all`, `athletes`, or `coaches`
- `updatedAt`

Publish new revision assigns a fresh revision so the same campaign can be shown again. Turn off changes only the enabled flag and timestamp, and does not upload the current unsaved editor draft. Existing Firestore rules allow administrators to write these records; published content is publicly readable and must not contain private account or clinical data.

The iOS client observes the announcement document while signed in. A delivery claim shared across root and baseline surfaces prevents duplicate simultaneous sheets. Seen state is per account, app identity, Firebase project and device. It is not a cloud-synced cross-device acknowledgement.

A general announcement may appear above the combined baseline through the baseline's announcement-only presenter. Closing it or following a link cannot release the requirement. An internal baseline link requests the strict combined-baseline gate after the message dismisses. Other HTTPS links open normally.

## Version-driven What's New

A release's optional `whatsNew` object uses the same content fields. The client selects the published record matching the installed version/build, rather than showing features from an update that has not been installed. It shows the release highlights once per scoped account/device and skips automatic highlights on the initial installation. Settings can revisit the same admin-authored content; older records retain the bundled fallback.

Edit these highlights uses a patch-only save for an existing release. It preserves release notes, build, critical-update status, media, creation time and other release metadata. Publishing disabled highlights does not upload an unpublished Markdown draft.

The existing newer-build/critical-upgrade modal remains a separate mechanism. Release highlights defer onboarding, consent, access, baseline and other required flows.

## Content and release order

The branded native renderer supports Markdown headings, paragraphs, emphasis, lists, quotes, code, images and links. Raw HTML is not executed. Links accept HTTPS and root-relative app paths. The app supplies its typography, spacing and colors.

Distribute an iOS build containing the remote-message client and publish the updated admin before using the new controls. Subsequent independent announcement changes do not require another app release. No announcement, version bump or broadcast is performed merely by deploying the editor.
