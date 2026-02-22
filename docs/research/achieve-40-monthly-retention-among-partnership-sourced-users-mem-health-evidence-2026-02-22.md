# Evidence Memo: Achieving ≥40% Monthly Retention for Partnership-Sourced Users

## Purpose

This evidence memo exists to inform how Pulse designs and operates the experience for users who join through partner channels (brands, gyms, run clubs) so that partnership-sourced cohorts retain at or above a 40% monthly threshold. The goal is to surface health behavior and product engagement evidence relevant to community-anchored and referral-based cohorts, then translate that into concrete levers Pulse and partners can pull to sustain usage beyond initial novelty.

This document will focus on:
- Evidence around engagement and retention in digital fitness and community-led products, with emphasis on socially anchored or referral-based cohorts
- Patterns that differentiate high-retention communities from low-retention cohorts
- Design implications for how Pulse structures partner-led experiences, touchpoints, and metrics to support ≥40% monthly retention

## Findings

1. **Socially anchored cohorts consistently show higher retention than individually acquired users.** Studies of online and app-based physical activity programs have found that participants who enroll with a friend, join via a group, or participate in social comparison features (leaderboards, team challenges) maintain higher engagement and retention compared with users who enroll alone through paid channels [1, 2]. The presence of an existing social tie increases perceived accountability and enjoyment, which are both associated with sustained participation.

2. **Perceived group identity and belonging are key drivers of continued participation in community fitness.** Qualitative and quantitative research on group exercise classes, CrossFit boxes, and run clubs indicates that members who strongly identify with their community (e.g., seeing themselves as part of a “crew” or “box”) report higher satisfaction and are more likely to continue attending sessions over time [3]. Community-anchored acquisition can thus support higher retention when the digital experience reinforces this identity, rather than treating users as isolated individuals.

3. **Structured, recurring social touchpoints outperform ad-hoc interactions for sustaining engagement.** Evidence from behavior change interventions suggests that scheduled group sessions, regular check-ins, and predictable communication cadences (weekly summaries, progress shout-outs) contribute to better adherence and lower dropout than interventions relying on sporadic or purely on-demand interactions [4]. For partnership-sourced users, aligning digital prompts and in-app rituals with the partner’s existing class schedule or run calendar can help keep monthly retention above threshold.

4. **Early demonstration of progress and competence predicts medium-term retention.** Across digital health and fitness products, users who see tangible progress markers in the first 2–4 weeks—such as improvements in performance metrics, streaks, or badges—are more likely to remain active at 8–12 weeks and beyond [5]. In community contexts, public recognition of these early wins (e.g., leaderboards within a club, shout-outs from coaches) amplifies their impact on motivation and ongoing attendance.

5. **Hybrid engagement (online + in-person or synchronous) is associated with stronger adherence than purely digital or purely offline models.** Research on blended interventions (combining app-based tracking with in-person classes, coach contact, or live virtual sessions) shows higher adherence and satisfaction compared with standalone digital tools [6]. Partnership-sourced users are naturally positioned for hybrid engagement because they already belong to a physical or synchronous community; when the app intentionally bridges the online and offline experience, retention rates typically outperform those of users acquired through impersonal channels.

## Recommended Intervention

**Stand up a “Club Pod” model for partnership-sourced users: small, identity-based squads with a 4-week rolling ritual and retention-triggered nudges anchored in the partner’s calendar.**

Synthesizing the findings above, an intervention aimed at sustaining ≥40% monthly retention for partnership-sourced users should intentionally leverage:
- The **social advantage** of partner channels (people join as part of a brand, box, or club) [1–3]
- The power of **structured, recurring touchpoints** instead of ad-hoc engagement [4]
- **Early, visible progress** and public recognition [5]
- The inherent **hybrid nature** of partner communities (in-person + digital) [6]

A concrete design for Pulse:

1. **Auto-create small “Club Pods” for every new partner cohort.**
   - On partner onboarding, Pulse automatically groups new signups into pods of ~5–10 members based on class time, pace group, or sub-community (e.g., “6am Barbell Crew”, “Wednesday Night Tempo Pod”).
   - Each pod is visibly tied to the partner’s identity (logo, colors, coach/leader avatar) to reinforce community belonging and identity [3].

2. **Attach each Pod to a 4-week rolling ritual aligned with the partner’s schedule.**
   - Every pod runs on a repeating 4-week rhythm (e.g., weekly flagship workout/route + 1–2 supporting sessions) mapped directly to the partner’s existing timetable [4, 6].
   - Pods see a simple, shared calendar inside Pulse that mirrors their gym/run club schedule, turning the app into the digital companion for an already committed routine rather than a separate “extra” task.

3. **Define “healthy engagement” for retention and track it at the pod level.**
   - For partnership-sourced users, operationalize “engaged this month” as:
     - Completing **≥1 in-person or live session per week** AND
     - Logging **≥1 digital touch** per week (check-in, reflection, or progress marker) [5, 6].
   - The partner dashboard and in-app pod view should surface:
     - % of pod members meeting this standard
     - Streaks of consecutive weeks meeting the standard
     - Highlighted pods that are “on fire” (e.g., ≥70% of members engaged for 4 straight weeks).

4. **Build a partner-led accountability loop on top of retention-triggered messaging.**
   - When a pod’s engagement begins to slip (e.g., <50% of members logging a session in 7 days), Pulse triggers a **tiered response**:
     - **Tier 1 – Automated nudge:** Friendly, club-branded push/email summarizing the pod’s recent wins and inviting them to the next ritual session [4, 5].
     - **Tier 2 – Captain/coach follow-up:** The pod’s designated leader gets a prompt with a short script to post in the pod chat or say in person (e.g., “Our Wednesday crew is back on this week—log your check-in in Pulse so we can keep our streak”).
     - **Tier 3 – Program tweak:** If low engagement persists for >2 weeks, the partner dashboard flags the pod for review (e.g., time slot misfit, workout too intense) so a coach can adjust the structure based on on-the-ground context [4, 6].

5. **Layer in early, visible progress and public recognition within the partner community.**
   - During the first 4–8 weeks, emphasize **low-bar progress markers**:
     - Attendance streaks (weeks attended in a row)
     - “Showed up with your crew” badges
     - Small performance milestones (e.g., total sessions logged, minutes on feet, sets completed) [5].
   - Pulse can auto-generate short recap tiles coaches can share in class or on social (“6am Barbell Crew: 82% of you hit last week’s sessions—keep the streak alive”), reinforcing both progress and identity [1–3].

**Why this supports ≥40% monthly retention for partnership-sourced users**

- **Community-anchored engagement instead of individual willpower:** By default, partnership-sourced users are dropped into pods that mirror their real-life communities (class times, pace groups, crews), turning the app into an extension of a social habit rather than a solo app they must remember to open [1–3].
- **Structured touchpoints increase the odds of repeat behavior:** Weekly rituals plus planned digital nudges align with evidence that recurring, predictable interactions outperform sporadic engagement for adherence [4]. This makes it more likely that users will meet a “≥1 session/week + ≥1 digital touch/week” standard across the month.
- **Early wins are made visible and socially meaningful:** By highlighting pod-level streaks and collective achievements, the intervention taps into both individual competence and group pride, which are linked to sustained engagement [3, 5].
- **Hybrid design maximizes partner strengths:** Because partner users already attend physical sessions or live runs, Pulse’s job is to tie those sessions to digital markers and social loops, capitalizing on blended models that outperform standalone digital tools [6]. If pods maintain even modest weekly activity under this structure, hitting a ≥40% monthly retention threshold across partnership cohorts becomes behaviorally plausible rather than aspirational.

## Sources

**Note:** Specific URLs/DOIs should be verified and added during a final editorial pass; references below identify core sources and publication venues.

[1] Zhang, J., Brackbill, D., Yang, S., Becker, J., Herbert, N., & Centola, D. (2016). Support or competition? How online social networks increase physical activity: A randomized controlled trial. *Preventive Medicine Reports*, 4, 453–458.

[2] Patel, M. S., Small, D. S., Harrison, J. D., Fortunato, M. P., Oon, A. L., Rareshide, C. A. L., Reh, G., Szwartz, M. L., et al. (2019). Effectiveness of behaviorally designed gamification interventions with social incentives for increasing physical activity among overweight and obese adults (STEP UP): A randomized clinical trial. *JAMA Internal Medicine*, 179(12), 1624–1632.

[3] Dawson, M. C. (2017). CrossFit: Fitness cult or reinventive institution? *International Review for the Sociology of Sport*, 52(3), 361–379.

[4] Michie, S., Abraham, C., Whittington, C., McAteer, J., & Gupta, S. (2009). Effective techniques in healthy eating and physical activity interventions: A meta-regression. *Health Psychology*, 28(6), 690–701.

[5] Yardley, L., Spring, B. J., Riper, H., Morrison, L. G., Crane, D. H., Curtis, K., Merchant, G. C., Naughton, F., & Blandford, A. (2016). Understanding and promoting effective engagement with digital behavior change interventions. *American Journal of Preventive Medicine*, 51(5), 833–842.

[6] Voth, E. C., Oelke, N. D., & Jung, M. E. (2016). A theory-based exercise app to enhance exercise adherence: A pilot study. *JMIR mHealth and uHealth*, 4(2), e62.