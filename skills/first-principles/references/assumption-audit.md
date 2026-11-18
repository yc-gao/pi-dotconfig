# Assumption Audit

Deep material for Steps 2–3. Read when an assumption is load-bearing and you are not sure it is real, or when a rule is in the way and you cannot tell whether it can be moved.

## What an assumption is made of

| Category | Question to ask |
|----------|-----------------|
| Technical | Must we use this technology or pattern? What does it actually cost at our scale? |
| Economic | Is this cost — money, latency, headcount, on-call — real, or vendor marketing? |
| Organizational | Does anyone actually own this constraint, and would they say no? |
| Historical | Why was this decided originally, and do those conditions still hold? |

## Trap patterns

- **"We've always done it this way"** → *Legacy trap.* Find the original reason. If it is gone, so is the constraint; if nobody can find it, that is itself a finding.
- **"Industry standard / Company X does it this way"** → *Analogy trap.* What problem were they solving, under what constraints, at what scale? Name the dimension where you differ, or you are copying an answer to someone else's question.
- **"Everyone uses X"** → popularity is evidence about support and hiring, not about fit.
- **"That's too simple to work"** → complexity is a cost, not evidence of rigor.
- **The constraint nobody wrote down** → the most expensive entries are usually the ones that did not feel technical: on-call burden, missing dashboards, upgrade paths, who has ever debugged this at 2am.

## Is it load-bearing?

If it is false, does the recommendation survive? If yes, it is not load-bearing — stop spending on it. If no, it needs a label better than `[assumed]` or an explicit sensitivity statement in Step 5.

## What each label requires

| Label | Requirement |
|-------|-------------|
| `[given]` | Supplied by the user, a colleague, or a vendor deck. Record who said it; it is an input, not evidence. Someone's "industry standard" always lands here. |
| `[verified]` | Say where it came from: a metric you read, a primary source, a config line, a code path — and who measured it |
| `[derived]` | Show the step from labelled facts; if the step needs an assumption, that is a new entry. A comparative judgement ("costs more than", "faster than") needs the arithmetic, or it is `[assumed]` |
| `[assumed]` | State how to verify and what verification costs |
| `[blocked]` | Name what you would need and from whom |

A user's self-report is not a verification. "We have 5 engineers and deploys take 20 minutes" is `[given]` — treating it as `[verified]` lets hearsay travel in the same bucket as measurement.

## Which constraints can actually be challenged

Half of all misuse of this method comes from treating a rule that someone can say no to as if it were physics.

| Kind | Examples | How to treat it |
|------|----------|-----------------|
| **Physical / mathematical** | Speed of light, CAP theorem, memory bandwidth, 24 hours in a day, quadratic query cost | Boundary conditions. Do not "challenge" them; design around them. |
| **Economic / organizational** | Vendor pricing, on-call burden, headcount, migration effort, hiring market | Genuinely challengeable — but the cost is real. Put the price in the ledger, not in a footnote. |
| **Normative / compliance / cultural** | Regulations, contracts, security baselines, audit requirements, team conventions | Challenge only after asking who owns the rule. Changing these is a negotiation or a project, not an insight. Never recommend skipping a control because it seems arbitrary. |

"That's just convention" is usually correct about *why* the rule exists and wrong about *whether you may ignore it*. The useful move is to separate the rule from its purpose and answer the purpose another way — scoping, key management, audit evidence — not to drop the control.

For a platform default (encryption at rest, say) only two questions are still open: **key custody** (provider-managed vs. CMEK vs. BYOK — a default key sitting next to the data defends against a stolen disk and little else) and **which layer** it covers (bucket/disk SSE and in-engine TDE protect different sets of bytes; neither covers an export in someone's bucket). Before any renegotiation get the citation and its owner — the control reference (PCI DSS 3.5, HIPAA §164.312, SOC 2 CC6.1, GDPR Art. 32), the document, the role who signs off.
