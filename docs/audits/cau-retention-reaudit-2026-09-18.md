# Operational baseline retention re-audit — September 18, 2026

Status: completed field-by-field product/privacy review; legal role and retention authority unresolved. This document does not change runtime storage. It covers all 61 active operational question IDs, not IRB alternatives or the separate native skills assessment. Source question 04 is replaced by name/email on web; identity is considered separately below.

## Findings

No question can be certified non-PHI or prohibited from PulseCheck storage from wording alone. HIPAA depends on identifiable health information and the covered-entity/business-associate role. PHI can lawfully be stored by a properly authorized and compliant business associate; the current PulseCheck separation policy is an additional architectural/contractual limit. Independent consumer collection and provider-directed intake are not interchangeable. Removing names while retaining an account mapping is not de-identification.

The current 48 external-only / 13 local split is conservative and is not a legal classification. Proposed review groups are not a validated instrument classification and do not authorize moving or copying existing responses.

- A: operational/performance candidate: 20 questions.
- B: private wellness candidate: 30 questions.
- C: retain external-only pending review: 11 questions.

A: strongest candidates for PulseCheck operational/performance retention, subject to role and privacy commitments. B: candidates for a restricted athlete/Nora wellness record only if the purpose, agreements and disclosure support it. No ordinary coach/performance-staff access. C: keep external-only until an explicit decision addresses clinical purpose, mixed choices or unrestricted narratives. C does not mean inherently PHI, and A does not mean legally cleared.

## Preserve clinical delivery

The clinical survey must continue to be sent in full to auntEDNA under the applicable authorization. Delivery destination and local retention eligibility must become separate allowlists. Do not simply reassign the custodian: that would remove newly retained fields from the clinical payload. Maintain the current 48-field clinical delivery set; any approved retention expansion must add copies without reducing that set. Preserve question versions, consent provenance and actor access restrictions. Do not backfill previously collected answers without checking the original permission and notice.

## Decision required before retention expansion

Establish whether this baseline is collected independently for PulseCheck or on behalf of auntEDNA/a covered institution, and inspect the executed BAA/data-sharing agreement. The locally available Exhibit A is labeled draft and does not establish executed terms. It reserves clinical intake and PHI to auntEDNA and permits limited contextual handoffs, not broad independent reuse. The questionnaire promises individual mental-health responses will not be shared with coaches or performance personnel; internal PulseCheck storage must not bypass that promise. Health authorization is separate from program participation and optional research. Non-HIPAA information can remain subject to privacy promises and other applicable law, including education-record rules where relevant.

Name, email, account ID, dates and provider linkage require restricted handling. They are ordinary identifiers in some contexts but can identify a clinical record in others. They are not a mechanism for declaring a health record non-PHI.

## Per-question map

| ID | Question | Current store | Review group | Reason |
|---|---|---|---|---|
| cau-operational-01 | I understand the purpose of this onboarding questionnaire and how my responses will be used. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-02 | I understand that individual mental-health responses will not be shared with coaches, teammates, or performance personnel. | auntEDNA | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-03 | I understand that I can still contact CAU counseling, medical, or emergency services directly when I need help. | auntEDNA | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-05 | Date completed: | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-06 | Date you first accessed either platform, if known: | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-07 | Which platform(s) have you used before today? | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-08 | Approximately how many total check-ins have you completed before today? | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-09 | Current academic year: | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-10 | Current volleyball status: | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-11 | Current season phase: | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-12 | Are you currently managing an injury or physical condition that affects training, competition, sleep, or recovery? | auntEDNA | C: retain external-only pending review | Explicit injury/physical-condition disclosure. |
| cau-operational-13 | If yes and you want the platforms to consider it, briefly describe the impact (optional): | auntEDNA | C: retain external-only pending review | Unrestricted injury/condition narrative. |
| cau-operational-14 | I felt emotionally balanced. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-15 | I was able to manage the demands placed on me. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-16 | I felt hopeful about the week ahead. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-17 | I had enough energy for my daily responsibilities. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-18 | I was able to concentrate on school, volleyball, and daily tasks. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-19 | Stress interfered with my ability to function the way I wanted. | auntEDNA | C: retain external-only pending review | Broad functional impairment assessment; retain clinical intake purpose pending review. |
| cau-operational-20 | Which areas have contributed to your stress during the past 7 days? Select all that apply. | auntEDNA | C: retain external-only pending review | Mixed stressors include injury/health and sensitive social circumstances; do not copy whole answer by default. |
| cau-operational-21 | Stress affected my sleep. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-22 | Stress affected my academic work. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-23 | Stress affected my focus during practice or competition. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-24 | Stress affected my relationships or willingness to connect with others. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-25 | Stress made it harder to recover physically. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-26 | Is there anything about your current stress that would help auntEDNA better support you? (Optional; do not use this space for an emergency.) | auntEDNA | C: retain external-only pending review | Free text explicitly requested for auntEDNA support. |
| cau-operational-27 | I get enough sleep to meet my daily demands. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-28 | My sleep usually is restful. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-29 | I normally recovered well between practices, workouts, and competitions. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-30 | Soreness, pain, or fatigue affected my performance readiness. | auntEDNA | C: retain external-only pending review | Combines pain with fatigue; health and performance cannot be separated from the answer. |
| cau-operational-31 | My schedule allows enough time for recovery. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-32 | On most nights during the past 7 days, about how many hours did you sleep? | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-33 | I feel physically ready to train or compete. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-34 | I feel mentally ready to train or compete. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-35 | I am able to stay focused during volleyball activities. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-36 | I feel confident in my current volleyball role. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-37 | I am able to recover after mistakes or difficult moments. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-38 | I feel comfortable communicating when I needed support or an adjustment. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-39 | What most affected your readiness during the past 7 days? Select up to three. | auntEDNA | C: retain external-only pending review | Mixed options include injury/pain; needs explicit field/option policy. |
| cau-operational-40 | How ready do you feel to meet your current volleyball demands? | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-41 | I feel that I belong on this team. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-42 | I feel respected within my athletic environment. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-43 | I can ask for help without being viewed as weak. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-44 | I know where to go for confidential mental-health support at CAU. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-45 | I would feel comfortable contacting a counselor or mental-health professional if I needed support. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-46 | I trust that my individual mental-health information will remain private from coaches and performance personnel. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-47 | If you wanted support, which options would you be most likely to use? Select all that apply. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-48 | What might make it harder for you to seek support? Select all that apply. | auntEDNA | B: private wellness candidate | Sensitive wellness, environment, engagement or support response; useful privately, but not cleared for independent PulseCheck retention. |
| cau-operational-49 | How would you prefer auntEDNA to respond when you indicate that you may need additional support? | auntEDNA | C: retain external-only pending review | Preference for auntEDNA clinical response; retain in care workflow. |
| cau-operational-50 | What is the best general way to remind you about a check-in? | auntEDNA | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-51 | What times generally work best for a brief check-in? | auntEDNA | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-52 | I understand the difference between performance support and mental-health support. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-53 | I understand what auntEDNA is intended to help me do. | auntEDNA | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-54 | I understand what PulseCheck is intended to help me do. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-55 | I feel comfortable using a digital platform for regular check-ins. | auntEDNA | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-56 | I understand who may and may not see my individual responses. | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-57 | What would make you more comfortable using the platforms? | auntEDNA | C: retain external-only pending review | Unrestricted text can contain diagnoses, treatment or other sensitive disclosures. |
| cau-operational-58 | What would make the platforms useful enough for you to continue checking in? | auntEDNA | C: retain external-only pending review | Unrestricted text can contain diagnoses, treatment or other sensitive disclosures. |
| cau-operational-59 | Do you know how to access PulseCheck? | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-60 | Do you know where to ask a question about privacy or how your information is used? | PulseCheck | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-61 | Would you like someone to follow up with general information about available support? | auntEDNA | A: operational/performance candidate | Defined non-diagnostic operational or sport-performance purpose; account context can still make the record PHI. |
| cau-operational-62 | Anything else you would like the onboarding team to know? (Optional; do not use this space for an emergency.) | auntEDNA | C: retain external-only pending review | Unrestricted onboarding narrative may contain clinical disclosures. |

## References checked

- HHS Summary of the HIPAA Privacy Rule: https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html
- HHS Health App Use Scenarios: https://www.hhs.gov/sites/default/files/ocr-health-app-developer-scenarios-2-2016.pdf
- Local draft: docs/deliverables/pulsecheck-auntedna-exhibit-a-draft.md, A.2–A.5.
- Current consent content: src/content/consents/defaults.json.
- Runtime map: src/content/questionnaires/cau-routing.json.
