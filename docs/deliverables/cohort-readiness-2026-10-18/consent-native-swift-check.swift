import Foundation
struct PulseCheckRequiredConsentDocument: Identifiable, Hashable {
    let id: String
    let title: String
    let body: String
    let version: String
    var category: String? = nil
    var studySpecific: Bool = false
    var consentCategory: String { category ?? (id.contains("research") ? "research" : "participation") }
    var allowsDecline: Bool { consentCategory == "health_authorization" || consentCategory == "research" }
    func decisionComplete(_ decisions: [String: [String: Any]], accepted: Set<String>, versions: [String: String] = [:]) -> Bool {
        if consentCategory == "staff" { return true }
        if let entry = decisions[id] {
            if version == "v1-pulsecheck", (entry["document"] as? [String: Any])?["category"] as? String != consentCategory { return false }
            return entry["version"] as? String == version && (entry["document"] as? [String: Any])?["body"] as? String == body && ((entry["decision"] as? String == "accepted") || (allowsDecline && ["declined", "revoked"].contains(entry["decision"] as? String ?? "")))
        }
        return version != "v1-pulsecheck" && consentCategory != "health_authorization" && accepted.contains(id) && (versions[id] == nil || versions[id] == version)
    }

    static func selectedForOrganization(_ documents: [PulseCheckRequiredConsentDocument], productBrand: String?) -> [PulseCheckRequiredConsentDocument] {
        guard productBrand == "pulsecheck" else { return documents }
        let originals = defaultDocuments(for: "operational")
        let replacements = pulseCheckOnlyDocuments()
        return documents.map { document in
            guard originals.contains(where: { $0.id == document.id && $0.version == document.version && $0.body == document.body && $0.title == document.title && $0.consentCategory == document.consentCategory }) else { return document }
            return replacements.first(where: { $0.id == document.id }) ?? document
        }
    }

    private static func pulseCheckOnlyDocuments() -> [PulseCheckRequiredConsentDocument] {
        [
            PulseCheckRequiredConsentDocument(id: "pulsecheck-program-participation", title: "Program participation and privacy", body: "PulseCheck supports performance, wellness reflection, and access to support. Licensed professionals remain responsible for clinical decisions and care.\n\nParticipation is voluntary. You may decline or stop participating without affecting team status, scholarship, playing time, medical care, academic standing, or your relationship with staff. You can choose whether to share optional wellness responses or connect approved wearables. Contact your program administrator to stop participation.\n\nParticipation may include onboarding, performance and wellness check-ins, mental training, conversations with Nora, optional wearable information, and feedback. PulseCheck may collect and retain approved program information to provide these features. Access is limited by role and purpose. Your program’s separate support choices and any required health-information authorization describe what information may be shared with support staff or licensed providers. Clinical notes, diagnoses and treatment records remain in the clinical environment.\n\nParticipant data must not be sold or used for unrelated advertising. Restricted clinical or mental-health information must not be used by PulseCheck for independent model training, commercial profiling or unrelated product development. Approved aggregate or properly de-identified information may support program evaluation and permitted product improvement. Identifiable research use requires its own applicable study consent, authorization or waiver and institutional approval.\n\nAI responses can be inaccurate. Participation may cause emotional discomfort or involve privacy and security risks. Benefits such as greater self-awareness or easier access to support are possible and are not guaranteed. During an emergency, call 911 or call or text 988, or use your institution’s urgent support resources. Platforms are not emergency response services.\n\nA proposed Tier 2 clinical handoff includes a separate choice to accept or decline. Declining that handoff leaves your participation and research choices unchanged. Urgent Tier 3 safety events follow approved institutional procedures and applicable law. Your participation choice does not authorize every disclosure. Health-information authorization, where required, and optional research are separate decisions. You retain your legal rights.", version: "v1-pulsecheck", category: "participation"),
            PulseCheckRequiredConsentDocument(id: "pulsecheck-health-authorization", title: "Health information sharing authorization", body: "This is a separate choice from joining your program. This authorization applies where HIPAA applies and authorization is required. You may authorize or decline. Declining limits only functions that require this authorization.\n\nInformation: approved onboarding answers about wellness, stress, sleep, emotional well-being and safety; approved wearable and recovery information; and the concern summary needed for your clinical handoff.\n\nWho may disclose: Pulse Intelligence Labs, your institution’s authorized health or counseling personnel, and licensed providers involved in your support, for information each lawfully maintains. Recipients: authorized institutional health or counseling personnel and licensed providers involved in your support. Purpose: approved onboarding transfer, care navigation and clinical-support workflows. Clinical notes, diagnoses and treatment records remain in the clinical environment. Coaches receive only information permitted for their role.\n\nPulse may collect and retain approved program information and transmit designated information. Restricted clinical information must not be used for independent model training, commercial profiling, advertising or unrelated product development. This authorization excludes optional research.\n\nThis authorization expires when your program participation ends. You may revoke it in writing through your program’s designated privacy contact or send a request to tre@fitwithpulse.ai for routing to the responsible privacy team. Revocation applies to future uses that rely on this authorization; prior reliance and uses otherwise permitted or required by law are unaffected. Your medical care, benefits, scholarship, team status, playing time and academic standing remain unaffected by your decision. Disclosed information may be redisclosed and may cease to be protected by HIPAA, while other protections may still apply. You can save a copy of your decision and these terms. Tier 2 support also asks for your event-specific choice. Urgent safety events follow the approved institutional protocol and applicable law.", version: "v1-pulsecheck", category: "health_authorization")
        ]
    }

    static func defaultDocuments(for studyMode: String) -> [PulseCheckRequiredConsentDocument] {
        [PulseCheckRequiredConsentDocument(id: "pulsecheck-program-participation", title: "Program participation and privacy", body: "PulseCheck supports performance, wellness reflection, and access to support. AuntEdna supports approved clinical-support and care-navigation workflows. Licensed professionals remain responsible for clinical decisions and care.\n\nParticipation is voluntary. You may decline or stop participating without affecting team status, scholarship, playing time, medical care, academic standing, or your relationship with staff. You can choose whether to share optional wellness responses or connect approved wearables. Contact your program administrator to stop participation.\n\nParticipation may include onboarding, performance and wellness check-ins, mental training, conversations with Nora, optional wearable information, and feedback. PulseCheck may initially collect and retain approved program information and securely send designated information to AuntEdna for authorized support, care navigation or safety workflows. Access is limited by role and purpose. AuntEdna-generated clinical notes, diagnoses, treatment information and restricted clinical information remain in the clinical environment. Only approved operational status may return to PulseCheck. Clinical or restricted mental-health information sent to AuntEdna must not be available to coaches through the ordinary PulseCheck workflow.\n\nParticipant data must not be sold or used for unrelated advertising. Restricted clinical or mental-health information must not be used by PulseCheck for independent model training, commercial profiling or unrelated product development. Approved aggregate or properly de-identified information may support program evaluation and permitted product improvement. Identifiable research use requires its own applicable study consent, authorization or waiver and institutional approval.\n\nAI responses can be inaccurate. Participation may cause emotional discomfort or involve privacy and security risks. Benefits such as greater self-awareness or easier access to support are possible and are not guaranteed. During an emergency, call 911 or call or text 988, or use your institution’s urgent support resources. Platforms are not emergency response services.\n\nA proposed Tier 2 clinical handoff includes a separate choice to accept or decline. Declining that handoff leaves your participation and research choices unchanged. Urgent Tier 3 safety events follow approved institutional procedures and applicable law. Your participation choice does not authorize every disclosure. Health-information authorization, where required, and optional research are separate decisions. You retain your legal rights.", version: "v1", category: "participation"), PulseCheckRequiredConsentDocument(id: "pulsecheck-health-authorization", title: "Health information sharing authorization", body: "This is a separate choice from joining your program. This authorization applies where HIPAA applies and authorization is required. You may authorize or decline. Declining limits only functions that require this authorization.\n\nInformation: approved onboarding answers about wellness, stress, sleep, emotional well-being and safety; approved wearable and recovery information; and the concern summary needed for your clinical handoff.\n\nWho may disclose: Pulse Intelligence Labs, AuntEdna, your institution’s authorized health or counseling personnel, and licensed providers involved in your support, for information each lawfully maintains. Recipients: AuntEdna and authorized institutional health or counseling personnel and licensed providers involved in your support. Purpose: approved onboarding transfer, care navigation and clinical-support workflows. AuntEdna clinical notes, diagnoses and treatment records remain in the clinical environment. Coaches receive only information permitted for their role.\n\nPulse may collect and retain approved program information and transmit designated information. Restricted clinical information must not be used for independent model training, commercial profiling, advertising or unrelated product development. This authorization excludes optional research.\n\nThis authorization expires when your program participation ends. You may revoke it in writing through your program’s designated privacy contact or send a request to tre@fitwithpulse.ai for routing to the responsible privacy team. Revocation applies to future uses that rely on this authorization; prior reliance and uses otherwise permitted or required by law are unaffected. Your medical care, benefits, scholarship, team status, playing time and academic standing remain unaffected by your decision. Disclosed information may be redisclosed and may cease to be protected by HIPAA, while other protections may still apply. You can save a copy of your decision and these terms. Tier 2 support also asks for your event-specific choice. Urgent safety events follow the approved institutional protocol and applicable law.", version: "v1", category: "health_authorization")] + (studyMode == "research" ? [PulseCheckRequiredConsentDocument(id: "pulsecheck-research-interest", title: "Optional research choice", body: "You may choose whether you are willing to participate in optional research. You can use PulseCheck and participate in the operational program whether you accept or decline.\n\nThis choice records willingness only. Before any research activity requiring consent begins, the study team must provide the applicable approved study-specific consent and any required research authorization or documented waiver. Those materials explain the study, information used, recipients, risks, benefits, and withdrawal process. Agreeing here alone does not make your information eligible for a research dataset.", version: "v1", category: "research")] : [])
    }

    private static let legacyDefaultDocumentIds: Set<String> = [
        "pulsecheck-team-participation-v1",
        "pulsecheck-data-privacy-v1"
    ]

    private static func normalizedStudyMode(_ value: String) -> String {
        switch value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "research":
            return "research"
        case "pilot":
            return "pilot"
        default:
            return "operational"
        }
    }

    private static func parseConsentVersionNumber(_ value: String) -> Int {
        let digits = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: CharacterSet.decimalDigits.inverted)
            .joined()

        return Int(digits) ?? 0
    }

    private static func legacyDefaultDocuments(for studyMode: String) -> [PulseCheckRequiredConsentDocument] {
        switch normalizedStudyMode(studyMode) {
        case "research":
            return [
                PulseCheckRequiredConsentDocument(
                    id: "pulsecheck-research-study-consent-v1",
                    title: "PulseCheck Research Study Consent",
                    body: """
                    You are being invited to take part in a research study involving PulseCheck and AuntEdna, which are supporting this study in partnership with your institution. The purpose of this study is to understand how PulseCheck tools, check-ins, and support workflows function during this team-based study and whether they are useful, usable, and acceptable to participants.

                    If you choose to participate, you may be asked to complete check-ins, use PulseCheck training features, connect approved wearable or health data sources, and allow the study team to review information generated during your participation. This may include check-ins, readiness signals, activity logs, session completion, connected health data you choose to share, survey responses, and support workflow events during the study period.

                    Your participation is voluntary. You may choose not to participate or may stop participating at any time. Stopping participation will not affect any rights or benefits to which you are otherwise entitled, except that data already collected may still be used to the extent allowed by law and approved study procedures.

                    Possible risks include loss of privacy, unauthorized access to data, mistaken interpretation of incomplete or inaccurate data, discomfort from questions or recommendations, and the possibility that some product features or support workflows may not function as intended during the study. There may also be risks related to sharing information digitally.

                    You may or may not receive direct benefit from participating. The study may help researchers, staff, and product teams better understand how to improve the platform and related support workflows.

                    If coaches, staff, clinicians, AuntEdna, or other support partners will receive participant-level information during this study, the study materials should identify what they may receive and why before participation begins.

                    Participation in this study does not waive any legal rights. Nothing in this consent releases the investigators, sponsor, institution, Pulse Intelligence Labs, Inc., AuntEdna, or their agents from responsibility where such a release is not allowed by law.

                    If you have questions about the study, contact Tremaine Grant at PulseCheck (tre@fitwithpulse.ai) or Dr. Tracey at AuntEdna (tracey@auntedna.ai). If you have questions about your rights as a participant, contact the IRB or research office identified in the study materials.
                    """,
                    version: "v3"
                ),
                PulseCheckRequiredConsentDocument(
                    id: "pulsecheck-research-data-authorization-v1",
                    title: "Research Data Authorization and Privacy Notice",
                    body: """
                    By agreeing to participate, you authorize the study team to collect and use the categories of data described in this disclosure for the stated study purposes.

                    These categories may include app check-ins and survey responses, session activity and completion data, readiness and support workflow data, connected wearable or health data you choose to authorize, and team or pilot participation metadata.

                    If this study uses education records, school records, health records, wearable data, or support workflow data, the study materials should identify what categories of information may be disclosed, the purpose of the disclosure, and the people or organizations that may receive the information, including PulseCheck personnel, AuntEdna personnel, your institution, and approved school, operational, or clinical partners involved in the study.

                    Access to identifiable information should be limited to authorized study personnel and approved operational, school, or clinical recipients described by the study, which may include PulseCheck and AuntEdna when they are operating or supporting the study workflow. Data may also be analyzed in de-identified or aggregated form when allowed by the study and applicable law.

                    Consumer health apps and wearable integrations are not automatically covered by HIPAA. If a covered provider, covered entity, or business associate is involved in a specific data flow, additional authorization or privacy notice may apply and should be provided separately.

                    Questions about research data use should be directed to Tremaine Grant at PulseCheck (tre@fitwithpulse.ai) or Dr. Tracey at AuntEdna (tracey@auntedna.ai). Questions about participant rights or institutional review should be directed to the IRB or research office identified in the study materials.
                    """,
                    version: "v3"
                )
            ]
        case "pilot":
            return [
                PulseCheckRequiredConsentDocument(
                    id: "pulsecheck-pilot-participation-notice-v1",
                    title: "PulseCheck Pilot Participation Notice",
                    body: """
                    You are being invited to take part in a PulseCheck pilot connected to your team and operated by PulseCheck in partnership with AuntEdna. This pilot is voluntary. You may choose not to participate or stop participating at any time.

                    If you stop participating or withdraw from the pilot, no new pilot data should be collected from your future pilot activity after that point. Information already collected before your withdrawal may still be retained and used to the extent allowed by law, institutional policy, and the pilot procedures described to you.

                    Because this is a pilot, some features, workflows, recommendations, alerts, and support pathways operated by PulseCheck and AuntEdna may change while the pilot is active. Some parts of the experience may be incomplete, experimental, or still being evaluated.

                    PulseCheck is not emergency response, not crisis care, and not a substitute for medical care, mental health treatment, or emergency services. If you believe you are in immediate danger, may harm yourself or someone else, or need urgent help, call 911, call or text 988, contact local emergency services, or use the crisis or care resources provided by your school right away.

                    Potential risks include privacy and security risks associated with digital systems, the possibility of incomplete or inaccurate data, mistaken interpretation, or product workflows that do not operate exactly as intended during the pilot.

                    You may or may not receive a direct benefit from participating. The pilot may help teams, staff, product groups, and AuntEdna support teams understand how to improve the platform and related support workflows.

                    Nothing in this notice waives any legal rights or releases Pulse Intelligence Labs, Inc., AuntEdna, your institution, or any other party from responsibility where such a release is not allowed by law.

                    If you have questions about the pilot, contact Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your team admin.
                    """,
                    version: "v4"
                ),
                PulseCheckRequiredConsentDocument(
                    id: "pulsecheck-pilot-privacy-and-data-use-v1",
                    title: "PulseCheck Pilot Privacy and Data Use",
                    body: """
                    PulseCheck and AuntEdna may use the information you share in the app, plus any health or wearable connections you choose to authorize, to operate the pilot experience and improve the product and support workflows connected to it.

                    This may include check-ins, readiness or recovery signals, session activity, survey responses, escalation or support workflow events, and connected wearable or health data that you choose to authorize during the pilot.

                    PulseCheck may share pilot-related information with authorized staff who support your team and, where applicable, with AuntEdna and connected care or support partners involved in the pilot workflow. Sharing should be limited to the minimum information needed to operate, review, and improve the pilot.

                    If the pilot uses education records or other school-linked data, the pilot materials should identify what categories of records may be disclosed, the purpose of the disclosure, and the person or class of people or organizations that may receive the information, such as authorized university athletics staff, sports medicine or support staff, PulseCheck personnel, AuntEdna personnel, or approved support partners involved in the pilot workflow.

                    Pilot data may be retained for the period needed to operate, review, document, secure, and improve the pilot, and to satisfy applicable law, institutional policy, contractual obligations, and audit or security requirements. If you withdraw, previously collected information may still be retained and used as allowed by law and policy, and de-identified or aggregated information may continue to be used for pilot review, internal reporting, or product improvement.

                    Consumer app and wearable data are not automatically protected by HIPAA in every workflow. If a covered provider, covered entity, or business associate, including AuntEdna when it is operating within a covered care or support workflow, is involved in a specific data flow, additional notice or authorization may apply.

                    Questions about pilot data use should be directed to Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your team admin.
                    """,
                    version: "v4"
                )
            ]
        default:
            return [
                PulseCheckRequiredConsentDocument(
                    id: "pulsecheck-operational-participation-notice-v1",
                    title: "PulseCheck Participation Notice",
                    body: """
                    Your team or organization is using PulseCheck, together with AuntEdna where applicable, as part of its current operational support and performance workflow. This notice explains the current-use experience and the information needed to operate it.

                    PulseCheck may use check-ins, readiness signals, session activity, survey responses, and other information you provide in the app to support day-to-day workflows tied to this program, including workflows supported by AuntEdna when it is participating in the program.

                    Some features, support pathways, and operational workflows may change over time as the system is maintained and improved.

                    Potential risks include privacy and security risks associated with digital systems, incomplete or inaccurate data, mistaken interpretation, or workflow errors that may require staff follow-up.

                    Nothing in this notice waives any legal rights or releases Pulse Intelligence Labs, Inc., AuntEdna, your institution, or any other party from responsibility where such a release is not allowed by law.

                    If you have questions about this program, contact Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your program administrator.
                    """,
                    version: "v3"
                ),
                PulseCheckRequiredConsentDocument(
                    id: "pulsecheck-operational-privacy-and-sharing-v1",
                    title: "PulseCheck Operational Privacy and Sharing",
                    body: """
                    PulseCheck may collect and use the information you provide in the app, plus any wearable or health data you choose to authorize, to operate current support, performance, and coordination workflows for your team or organization, including workflows supported by AuntEdna where applicable.

                    Authorized staff may view the minimum information needed to operate those workflows, respond to concerns, and improve the service. This may include check-ins, readiness trends, session activity, support workflow events, approved connected-data summaries, and AuntEdna-supported care or support coordination information when AuntEdna is part of the workflow.

                    If education records, school-linked data, or support-program records are used, the operational materials should identify what categories of information are used, the purpose of the use or disclosure, and the people or organizations that may receive the information, which may include PulseCheck personnel, AuntEdna personnel, and authorized school or support-program staff.

                    Consumer apps and wearable integrations are not automatically HIPAA-covered in every workflow. If a covered provider, covered entity, or business associate, including AuntEdna when it is operating inside a covered care or support workflow, is involved in a specific data flow, additional notice or authorization may apply.

                    Questions about operational data use or sharing should be directed to Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your program administrator.
                    """,
                    version: "v3"
                )
            ]
        }
    }

    private static var allDefaultDocumentIds: Set<String> {
        Set(
            legacyDefaultDocumentIds.union(
                defaultDocuments(for: "operational").map(\.id)
                    + defaultDocuments(for: "pilot").map(\.id)
                    + defaultDocuments(for: "research").map(\.id)
                    + legacyDefaultDocuments(for: "operational").map(\.id)
                    + legacyDefaultDocuments(for: "pilot").map(\.id)
                    + legacyDefaultDocuments(for: "research").map(\.id)
            )
        )
    }

    static func decodeList(_ value: Any?) -> [PulseCheckRequiredConsentDocument] {
        guard let rawItems = value as? [[String: Any]] else { return [] }

        return rawItems.compactMap { item in
            let id = (item["id"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let title = (item["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let body = (item["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let version = (item["version"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "v1"

            guard !id.isEmpty, !title.isEmpty, !body.isEmpty else { return nil }
            return PulseCheckRequiredConsentDocument(id: id, title: title, body: body, version: version.isEmpty ? "v1" : version, category: item["category"] as? String, studySpecific: item["studySpecific"] as? Bool ?? false)
        }
    }

    static func mergedWithDefaults(
        studyMode: String,
        consents: [PulseCheckRequiredConsentDocument]
    ) -> [PulseCheckRequiredConsentDocument] {
        let defaults = defaultDocuments(for: studyMode)
        let defaultsById = Dictionary(uniqueKeysWithValues: defaults.map { ($0.id, $0) })
        let currentDefaultIds = Set(defaults.map(\.id))
        var mergedById = defaultsById

        for consent in consents {
            if allDefaultDocumentIds.contains(consent.id) && !currentDefaultIds.contains(consent.id) {
                continue
            }

            guard let defaultConsent = defaultsById[consent.id] else {
                mergedById[consent.id] = consent
                continue
            }

            if parseConsentVersionNumber(consent.version) < parseConsentVersionNumber(defaultConsent.version) {
                continue
            }

            mergedById[consent.id] = consent
        }

        return Array(mergedById.values)
            .sorted { left, right in
                let defaultOrder = defaults.map(\.id)
                let leftIndex = defaultOrder.firstIndex(of: left.id) ?? Int.max
                let rightIndex = defaultOrder.firstIndex(of: right.id) ?? Int.max
                if leftIndex != rightIndex {
                    return leftIndex < rightIndex
                }
                return left.title < right.title
            }
    }

    static func encodeList(_ consents: [PulseCheckRequiredConsentDocument]) -> [[String: Any]] {
        consents.map { consent in
            [
                "id": consent.id,
                "title": consent.title,
                "body": consent.body,
                "version": consent.version,
                "category": consent.consentCategory,
                "studySpecific": consent.studySpecific
            ]
        }
    }

    var previewText: String {
        let compact = body
            .replacingOccurrences(of: "\n\n", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let sentences = compact
            .split(separator: ".")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        if sentences.count >= 2 {
            return "\(sentences[0]). \(sentences[1])."
        }

        if let first = sentences.first {
            return "\(first)."
        }

        return compact
    }

    var bodyParagraphs: [String] {
        body
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    var downloadFileName: String {
        let sanitizedTitle = title
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))

        return sanitizedTitle.isEmpty ? "pulsecheck-agreement.pdf" : "\(sanitizedTitle).pdf"
    }
}


func receipt(_ d: PulseCheckRequiredConsentDocument, _ choice: String = "accepted") -> [String: [String: Any]] { [d.id: ["version": d.version, "decision": choice, "document": ["body": d.body, "category": d.consentCategory]]] }
let original = PulseCheckRequiredConsentDocument.defaultDocuments(for: "operational")
let pc = PulseCheckRequiredConsentDocument.selectedForOrganization(original, productBrand: "pulsecheck")
assert(pc.allSatisfy { $0.version == "v1-pulsecheck" })
assert(PulseCheckRequiredConsentDocument.selectedForOrganization(original, productBrand: "athleticmind") == original)
for (old, new) in zip(original, pc) {
 assert(!new.decisionComplete(receipt(old), accepted: [old.id]))
 assert(!new.decisionComplete([:], accepted: [new.id], versions: [new.id:new.version]))
 assert(new.decisionComplete(receipt(new), accepted: []))
 assert(new.decisionComplete(receipt(new, "declined"), accepted: []) == new.allowsDecline)
 assert(old.decisionComplete(receipt(old), accepted: []))
}
let changedBody = PulseCheckRequiredConsentDocument(id: original[0].id, title: original[0].title, body: "Custom institution wording", version: "v1", category: "participation")
assert(PulseCheckRequiredConsentDocument.selectedForOrganization([changedBody], productBrand: "pulsecheck") == [changedBody])
assert(!changedBody.decisionComplete(receipt(original[0]), accepted: []))
assert(changedBody.decisionComplete([:], accepted: [changedBody.id]))
print("PASS: 15 isolated Swift consent assertions against extracted current model. Includes legacy custom-document fallback acceptance.")
let parityFile = "/tmp/consent-native-swift-documents.json"
let parityDocs = ["athleticmind": PulseCheckRequiredConsentDocument.defaultDocuments(for: "research"), "pulsecheck": PulseCheckRequiredConsentDocument.selectedForOrganization(PulseCheckRequiredConsentDocument.defaultDocuments(for: "research"), productBrand: "pulsecheck")].mapValues { docs in docs.map { d in ["id":d.id, "title":d.title, "body":d.body, "version":d.version, "category":d.consentCategory] } }
try! JSONSerialization.data(withJSONObject: parityDocs, options: [.sortedKeys]).write(to: URL(fileURLWithPath: parityFile))
