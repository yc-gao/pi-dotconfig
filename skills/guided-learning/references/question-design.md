# Designing the Check

A check exists to find out where the learner's model is broken. It is diagnostic, not a grade. If every answer is right and the questions felt easy, the questions were too weak.

## What a good check does

Test the **edge**, not the node. Recalling a name proves nothing; moving along a logical edge proves the network is there.

Four useful levels, roughly in order of strength:

| Level | Question shape | What it proves |
|---|---|---|
| **Derive** | "Given A, why must B follow?" | the learner can rebuild a node from its neighbour |
| **Transfer** | "Here is a case I did not cover — what happens?" | the knowledge generalized instead of being memorized per example |
| **Discriminate** | "These two situations look similar; which applies, and why?" | the learner knows the boundary of the concept |
| **Predict** | "What breaks if we remove X?" | the learner knows why the structure exists |

Weak checks to avoid: definition recall, "do you understand?", yes/no framing, questions whose answer is in the text you just wrote.

## Multiple choice by default

One question per turn, 3–4 options, short and self-explanatory.

- **Distractors carry the signal.** Build them from real misconceptions — what a beginner plausibly believes, the consequence of confusing two adjacent concepts, the answer that is right in a neighbouring case. A distractor nobody would pick teaches you nothing.
- **No giveaway phrasing.** Options should be similar in length and concreteness; avoid "all of the above" and joke options.
- **One correct answer.** If two are defensible, the question is not ready — either sharpen it or turn it into an open question.
- **Ask for reasoning after the pick**, not before: "which one, and in one line why". The pick tells you what they believe; the reason tells you whether they believe it for the right cause.
- **Offer "not sure" where honest.** Guessing and knowing are different data points. Do not punish it; it tells you where to start repairing.

## Open questions, sparingly

Use one when the topic is about making a judgment or explaining a mechanism — cases where multiple choice would flatten the interesting part. Ask for two or three sentences, then read the answer for **which edge is missing**, not for polish. Vague but correct usually means the learner is holding the right shape without the load-bearing detail; ask them to make the vague part specific.

## Never true/false

A coin flip carries no information, and a confident learner learns nothing from being right half the time.

## After the answer

- **Right, for the right reason:** move on. Do not pad with praise or an extra lecture.
- **Right, for the wrong reason:** this is the most dangerous case — the model is wrong and reinforced. Ask what would happen in a variant case, then correct the underlying edge.
- **Wrong:** name the specific missing or wrong edge, not the topic. Repair that edge with one concrete example, then ask a **fresh variant** — never the identical question.
- **"Not sure":** back up one node and see whether the earlier node actually holds. Usually the failure is there, not at the current one.

## Recording

In the note's checks section, keep one line per check:

```markdown
### 3.2 Edge: entropy -> information content
- Q: which encoding is shorter for this distribution?
- Answer: picked the fixed-length option
- Diagnosis: missing that the length depends on probability, not alphabet size
- Status: repaired, passed a variant
```

The wrong path is the most valuable entry. The learner will hit the same fork again months later.
