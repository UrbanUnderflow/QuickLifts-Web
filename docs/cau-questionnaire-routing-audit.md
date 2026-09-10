# CAU operational questionnaire routing audit

Audit date: September 9, 2026. Routing: cau-routing-v2.

Scope: the two sections of the current operational web questionnaire. The alternative IRB forms and native app flows were not changed in this audit. Original wording and answer choices are preserved. Item 04 remains replaced by name and email.

Result: 13 PulseCheck fields; 48 auntEDNA fields, including an injury follow-up shown only when item 12 is Yes (otherwise 47 visible). Seventeen fields moved from PulseCheck to auntEDNA. This includes acknowledgements and setup fields, not only substantive questions.

This is conservative product/privacy routing, not a legal HIPAA determination. The auntEDNA section includes health context, support preferences, and mixed-purpose fields as well as clinical content. Sport-specific items 34–37 are retained in PulseCheck, but their use requires alignment with the source data-sharing schedule before live collection.

Raw auntEDNA-designated answers are excluded from the PulseCheck model. PulseCheck references contain question IDs and external receipt/record IDs only, without answer values or hashes. Direct integration remains pending and saving remains disabled. Existing stored records have not been migrated or changed.

| ID | Question | Destination | Change | Reason |
|---|---|---|---|---|
| 1 | I understand the purpose of this onboarding questionnaire and how my responses will be used. | PulseCheck | Retained | General questionnaire-purpose acknowledgement. |
| 2 | I understand that individual mental-health responses will not be shared with coaches, teammates, or performance personnel. | auntEDNA | Moved from PulseCheck | Mental-health confidentiality acknowledgement belongs with the protected workflow. |
| 3 | I understand that I can still contact CAU counseling, medical, or emergency services directly when I need help. | auntEDNA | Moved from PulseCheck | Clinical/emergency support acknowledgement. |
| 5 | Date completed: | PulseCheck | Retained | Completion date metadata. |
| 6 | Date you first accessed either platform, if known: | auntEDNA | Moved from PulseCheck | First access to either service can include auntEDNA care engagement. |
| 7 | Which platform(s) have you used before today? | auntEDNA | Moved from PulseCheck | Cross-platform use can reveal auntEDNA engagement. |
| 8 | Approximately how many total check-ins have you completed before today? | auntEDNA | Moved from PulseCheck | Combined check-ins include auntEDNA engagement. |
| 9 | Current academic year: | PulseCheck | Retained | Academic year, general setup. |
| 10 | Current volleyball status: | auntEDNA | Moved from PulseCheck | Modified/nonparticipation status can reveal health-related limitation; keep protected under current broad wording. |
| 11 | Current season phase: | PulseCheck | Retained | Season phase, general performance context. |
| 12 | Are you currently managing an injury or physical condition that affects training, competition, sleep, or recovery? | auntEDNA | Moved from PulseCheck | Direct injury or physical-condition disclosure. |
| 13 | If yes and you want the platforms to consider it, briefly describe the impact (optional): | auntEDNA | Moved from PulseCheck | Unrestricted description of injury/condition impact; show only after Yes to item 12. Shown only when item 12 is Yes. |
| 14 | I felt emotionally balanced. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 15 | I was able to manage the demands placed on me. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 16 | I felt hopeful about the week ahead. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 17 | I had enough energy for my daily responsibilities. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 18 | I was able to concentrate on school, volleyball, and daily tasks. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 19 | Stress interfered with my ability to function the way I wanted. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 20 | Which areas have contributed to your stress during the past 7 days? Select all that apply. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 21 | Stress affected my sleep. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 22 | Stress affected my academic work. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 23 | Stress affected my focus during practice or competition. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 24 | Stress affected my relationships or willingness to connect with others. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 25 | Stress made it harder to recover physically. | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 26 | Is there anything about your current stress that would help auntEDNA better support you? (Optional; do not use this space for an emergency.) | auntEDNA | Retained | Confidential well-being or stress assessment; retain the instrument together. |
| 27 | I get enough sleep to meet my daily demands. | auntEDNA | Retained | Sleep, pain, fatigue or recovery assessment. |
| 28 | My sleep usually is restful. | auntEDNA | Retained | Sleep, pain, fatigue or recovery assessment. |
| 29 | I normally recovered well between practices, workouts, and competitions. | auntEDNA | Retained | Sleep, pain, fatigue or recovery assessment. |
| 30 | Soreness, pain, or fatigue affected my performance readiness. | auntEDNA | Retained | Sleep, pain, fatigue or recovery assessment. |
| 31 | My schedule allows enough time for recovery. | auntEDNA | Retained | Sleep, pain, fatigue or recovery assessment. |
| 32 | On most nights during the past 7 days, about how many hours did you sleep? | auntEDNA | Retained | Sleep, pain, fatigue or recovery assessment. |
| 33 | I feel physically ready to train or compete. | auntEDNA | Moved from PulseCheck | Physical health/readiness, not narrowly mental performance. |
| 34 | I feel mentally ready to train or compete. | PulseCheck | Retained | Sport-specific mental readiness; no clinical details requested. |
| 35 | I am able to stay focused during volleyball activities. | PulseCheck | Retained | Focus specifically during volleyball. |
| 36 | I feel confident in my current volleyball role. | PulseCheck | Retained | Confidence in volleyball role. |
| 37 | I am able to recover after mistakes or difficult moments. | PulseCheck | Retained | Recovering after sport mistakes or difficult moments. |
| 38 | I feel comfortable communicating when I needed support or an adjustment. | auntEDNA | Moved from PulseCheck | Support or adjustment can concern injury, accommodation or health needs. |
| 39 | What most affected your readiness during the past 7 days? Select up to three. | auntEDNA | Moved from PulseCheck | Mixed choices explicitly include injury/pain, stress and fatigue; keep the whole item together. |
| 40 | How ready do you feel to meet your current volleyball demands? | auntEDNA | Moved from PulseCheck | Overall readiness includes physical/health readiness. |
| 41 | I feel that I belong on this team. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 42 | I feel respected within my athletic environment. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 43 | I can ask for help without being viewed as weak. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 44 | I know where to go for confidential mental-health support at CAU. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 45 | I would feel comfortable contacting a counselor or mental-health professional if I needed support. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 46 | I trust that my individual mental-health information will remain private from coaches and performance personnel. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 47 | If you wanted support, which options would you be most likely to use? Select all that apply. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 48 | What might make it harder for you to seek support? Select all that apply. | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 49 | How would you prefer auntEDNA to respond when you indicate that you may need additional support? | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 50 | What is the best general way to remind you about a check-in? | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 51 | What times generally work best for a brief check-in? | auntEDNA | Retained | Team safety, support awareness, help-seeking or auntEDNA check-in preferences. |
| 52 | I understand the difference between performance support and mental-health support. | PulseCheck | Retained | Understanding the distinction between two services. |
| 53 | I understand what auntEDNA is intended to help me do. | auntEDNA | Moved from PulseCheck | auntEDNA-specific product feedback. |
| 54 | I understand what PulseCheck is intended to help me do. | PulseCheck | Retained | PulseCheck-specific product understanding. |
| 55 | I feel comfortable using a digital platform for regular check-ins. | auntEDNA | Moved from PulseCheck | Check-ins are not limited to PulseCheck; mixed-service feedback. |
| 56 | I understand who may and may not see my individual responses. | PulseCheck | Retained | General understanding of data access. |
| 57 | What would make you more comfortable using the platforms? | auntEDNA | Moved from PulseCheck | Unrestricted feedback about both platforms may disclose personal health information. |
| 58 | What would make the platforms useful enough for you to continue checking in? | auntEDNA | Moved from PulseCheck | Unrestricted feedback about both platforms may disclose personal health information. |
| 59 | After completing this questionnaire, do you understand how to access auntEDNA and PulseCheck? | PulseCheck | Retained | Understanding how to access the two services, not usage history. |
| 60 | Do you know where to ask a question about privacy or how your information is used? | PulseCheck | Retained | Knowing where to ask privacy questions. |
| 61 | Would you like someone to follow up with general information about available support? | auntEDNA | Moved from PulseCheck | Support follow-up request belongs with the confidential support pathway. |
| 62 | Anything else you would like the onboarding team to know? (Optional; do not use this space for an emergency.) | auntEDNA | Retained | Unrestricted onboarding free text can contain health details. |
