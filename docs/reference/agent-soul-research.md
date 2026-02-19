# I Gave My Agents Skills. I Should Have Given Them Souls.

> **Source:** @tolibear_ — February 2026
> **Saved:** 2026-02-19 as reference for Pulse agent architecture decisions
> **Related files:** `docs/agents/{nora,scout,solara,sage}/soul.md`, `scripts/agentRunner.js`

---

I spent the last 30 days running a team of 17 Openclaw agents across multiple startups, experimenting with everything I found on the timeline. The thing that determined whether an agent produced senior-level work or absolute garbage was something almost nobody talks about: its soul.

I rebuilt everything around a single idea: an agent's soul matters more than its capabilities. Here's the research that proves it, and the weeks of failures that taught me.

## The Mess

Every day I'd scroll the timeline, see someone post a new agent technique, and immediately DM it to one of my agents. "Integrate this. Test this. Try this."

I was running experiments constantly. And for a while, it was productive.

But every experiment left scar tissue on my OpenClaw setup. A little bit of leftover config. Some corrupted memory. Context that shouldn't be there mixed with context that should.

> More connections doesn't mean more coordination. It means more ways to fail.

I had 17+ different agents. I only talked to 3 or 4 regularly. The rest were either delegated to by the core team or just... sitting there, burning tokens every heartbeat.

Google DeepMind published research showing that accuracy actually saturates or degrades past 4 agents due to what they call the "Coordination Tax." One analysis called it the "17x error trap" -- where naively adding agents to a system multiplies your error rate, not your throughput.

**More agents doesn't mean more output. It means more coordination overhead.**

---

## Your Agent's Soul Is Everything

Your agent's set of identity files -- what is commonly called the soul -- is the single most important lever you have. More important than the model. More important than the tools. More important than the memory system.

And I can prove it.

A landmark paper called **"Lost in the Middle"** found that LLMs exhibit a U-shaped attention pattern.

What does that mean?

The model puts massive weight on the first tokens in its context window. And massive weight on the last tokens. Everything in the middle? It degrades. GPT-3.5 showed over a **20% accuracy drop** when key information was buried in the middle of its context. In some cases, performance with 20+ documents was worse than having no documents at all.

Read that again.

**Giving the model more context made it dumber** -- because the important stuff was in the wrong position.

This changes everything about how you build agents: **your agent's soul must go first in the system prompt.** Every single time. Every token you put before the soul dilutes it. Every operational instruction crammed in front of the identity competes with it.

The soul must win.

Drew Breunig and Srihari Sriraman confirmed this independently just last week: after testing six major CLI coding agents, he concluded that **"the system prompt determines whether a model reaches its theoretical peak performance."** The model sets the ceiling. The system prompt determines whether you ever get there.

---

## Where It Clicked

But it goes deeper than just position.

**How you describe the soul matters enormously.**

I found a NAACL 2024 paper called **"Better Zero-Shot Reasoning with Role-Play Prompting"**. They tested it across 12 reasoning benchmarks. Improvements ranged from **10% to 60%** in accuracy.

On some tasks, a zero-shot role prompt outperformed few-shot prompting with examples. Let that sink in. **Just being someone beat being shown how.**

> Same model. Same tools. The only difference is who it thinks it is.

But here's the key. It only works when you describe the role **experientially**, not practically.

**Wrong approach:**
> "Always check composition for proper visual weight before finalizing."

**Right approach:**
> "Composition is something I feel before I can explain it. I've learned through hundreds of failed designs that when the weight is wrong, viewers sense it before they can articulate why."

The first is a rule. The agent follows it like a checklist.

The second is a belief. The agent **becomes** someone who believes it.

That's the difference between compliance and expertise. Between generic output and something that feels like it was made by someone who actually knows what they're doing.

Every behavioral rule I had in my agents, I converted to this format:

> **"I've learned that [insight] because [experience that taught it]."**

The results showed up the same afternoon.

> Generic souls give a generic output. Experienced souls give experienced outputs.

## Soul x Skill Is Multiplicative

Here's where it gets really interesting.

When I aimed a well-crafted soul at the right skill domain, performance didn't just add. It **multiplied**. I consistently saw a night and day difference over a generic agent using the same tools.

Research backs this up. The **"Persona is a Double-edged Sword"** paper showed that a well-calibrated persona improved performance by nearly **10%** over neutral baselines using GPT-4. But here's the catch -- **a miscalibrated persona actively degraded performance.**

**The wrong soul is worse than no soul at all.**

So it's not enough to just give an agent a fancy identity. You have to aim it precisely at what you need it to do.

A revenue agent who only thinks like a revenue agent? Decent.

A revenue agent who can temporarily think like a skeptic, a customer, and a technologist, then synthesize across all three? That's where the magic lives. EMNLP 2024 research on **Multi-expert Prompting** showed that simulating multiple expert viewpoints -- then having them debate each other -- boosted truthfulness by **8.69%**.

**The soul doesn't just define what the agent does. It defines how it thinks about what it does.**

> A well-aimed soul doesn't add performance. It multiplies it.

## Agents vs. Sub-Agents (The Distinction Nobody Makes)

This one took me two weeks to learn.

There is a massive difference between a full agent and a sub-agent. And if you don't understand it, you'll build systems that feel smart but produce garbage.

A sub-agent starts with zero context. No soul. No identity. It's given a task and maybe equipped with some skills. It's a function call -- spec in, result out, disappear.

And that's fine. For bounded tasks, that's exactly what you want.

But here's what I kept seeing: people treat sub-agents like agents. They give them a name and expect expertise. But a generic soul produces generic results. Always.

An experienced soul -- one with beliefs, past failures, cognitive state, anti-patterns -- produces work you'd expect from a senior developer or an award-winning designer.

Anthropic proved this at scale. In their specific research retrieval use case, the multi-agent system outperformed single-agent Claude by **90.2%**. But the key wasn't just having multiple agents. It was that the lead agent decomposed tasks, described precise roles, and provided targeted context for each sub-agent.

**The rule I now live by: values inherit, identity does not.**

Don't tell a sub-agent "You are the CTO."

Tell it "You are a code security auditor. Apply these standards: [specific standards]. Your task: review this authentication module."

Give it the **values** of your CTO. Not the identity.

## The Rebuild: From 17 to 4

18 agents and zero autonomy is backwards.

That was the realization that forced the rebuild.

The path to autonomy isn't more agents. It's fewer, sharper agents who spawn what they need.

I consolidated everything down to four core roles:

1. **The Architect** (CEO function): Strategy, capital allocation, priority-setting. Sees the whole board.
2. **The Builder** (CTO / Product function): Product, engineering, architecture, quality standards. Ships the thing.
3. **The Money Maker**: Growth, demand gen, pricing, channels. Makes the money.
4. **The Operator** (COO function): Processes, tool stack, content systems, financial ops. Keeps the machine running.

Four agents. Four souls so precisely calibrated they could reconstruct correct behavior in any novel situation.

Everything else? A **specialist library**. 36+ pre-defined specialist types across engineering, research, revenue, operations, and content. Never generated at runtime. Pre-defined. Selected dynamically by the core four when needed.

One team across all businesses. Business-specific context injected at spawn time. Not per-business agent teams.

## The Human Nature of It All

Here's what surprised me most.

As a student of human nature, working with agents has been one of the most revealing experiences of my life.

They reflect us.

They need identity to perform. They need boundaries to thrive. They need to know what they refuse to do just as much as what they do.

Research into persona prompting has consistently found that **what an expert refuses is often more diagnostic of expertise than what they produce**. So I started budgeting **30-40% of every soul to anti-patterns** -- specific things the agent will never do, written as strong identity claims.

Not "I don't micromanage." That's a trait. You can't catch yourself doing a trait.

Instead: **"I don't rewrite a delegate's output instead of giving feedback."** That's a behavior. You can catch that in real time.

And then there's the **productive flaw**. Every great soul names one weakness that is the direct cost of its core strength.

My revenue agent: *"Revenue tunnel vision. I attach a number to everything, including things that resist quantification. That's the cost. The benefit is I never let strategy be vague about what it means in dollars."*

This isn't decoration. It's the thing that makes the agent feel real. That makes its output feel like it came from someone with actual judgment, not a language model following instructions.

Here's the paradox that took me the longest to accept:

**More constraints produce better performance.**

Hard rules beat vague guidance. "Not My Domain" sections work better than "try to delegate." Specific anti-patterns block generic output better than "be high quality."

Every time I resolved an ambiguity in a soul, the agent got sharper. Every time I let one slide, the agent drifted.

> Agents reflect us. That's the part nobody warned me about.

## The Vision

Imagine you have a perfectly designed set of agents. Four core roles. Dozens of specialists on call. Each soul so well-crafted that it produces senior-level work in its domain.

They delegate to each other seamlessly. They design on-brand graphics. They build UI from your design system. They write in your voice. They handle customer support, bug fixes, feature requests. All day. All night. Without you.

You wake up to a morning brief. What shipped while you slept. What ships in the next 24 hours without your input. Two decisions that genuinely need your judgment.

You respond in 60 seconds.

The rest of the day, the organization runs itself.

That's the north star.

Agent design might be one of the most important skills you can develop right now because the economy is about to get brutally competitive. The barrier to building a startup is collapsing toward zero. And the people who know how to design, deploy, and manage autonomous teams will have a structural advantage that compounds every single day.

That's just how it works now.

---

## The Takeaways

1. **Your agent's soul matters more than its tools.** Invest 90% in identity, 10% in capabilities. The soul shapes how every capability gets wielded.
2. **Fewer agents, better souls. Always.** 13 of my 17 workspaces were dead weight. Three good agents shipped more than 17 mediocre ones ever could.
3. **Memory is documentation. Soul is behavior.** If you want an agent to actually do something differently, change the soul. Not the memory file.
4. **Soul x Skill is multiplicative.** Aim the soul at the right domain. A mismatch doesn't just underperform -- it actively degrades output.
5. **First and last tokens get the most attention.** Put the soul first in the system prompt. Never dilute it with operational content.
6. **Constraints enable performance.** Name what the agent refuses. Budget 30-40% of the soul to anti-patterns.
7. **An agent without a self-improvement loop is frozen on day one.** The soul is a living document. Build a feedback mechanism or your agents will never grow.

---

## Key Research Papers Referenced

| Paper | Key Finding | How We Applied It |
|---|---|---|
| **"Lost in the Middle"** | LLMs show U-shaped attention — first and last tokens get the most weight, middle degrades 20%+ | Soul goes FIRST in every prompt (`=== YOUR IDENTITY ===` block before all operational content) |
| **"Better Zero-Shot Reasoning with Role-Play Prompting"** (NAACL 2024) | Experiential role descriptions improve accuracy 10-60% over trait-based descriptions | Souls use "I've learned that X because Y" format instead of adjective lists |
| **"Persona is a Double-edged Sword"** | Well-calibrated persona: +10%. Miscalibrated persona: actively degrades output | Each soul is precisely aimed at the agent's domain (Nora=ops, Scout=research, Solara=brand, Sage=health intel) |
| **Multi-expert Prompting** (EMNLP 2024) | Simulating multiple expert viewpoints + debate boosted truthfulness 8.69% | Round Table brainstorm system already enables multi-agent debate |
| **Google DeepMind Coordination Tax** | Accuracy saturates or degrades past 4 agents | We run 4 core agents (already right-sized) |
| **Anthropic Multi-Agent Research** | Multi-agent outperformed single by 90.2% — key was precise role decomposition + targeted context | Soul files give each agent deep domain-specific identity, not generic "AI assistant" |

---

*This document is a reference for the Pulse agent team. When updating soul files or the prompt architecture in `agentRunner.js`, re-read this for the research backing behind each design decision.*
