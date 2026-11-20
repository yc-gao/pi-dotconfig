---
name: learn
description: >
  Teach a topic from what the user already knows: research it, agree on a goal, verify their existing knowledge, plan, then teach and test one task at a time, optionally recording synced notes in their Obsidian vault.
  Use whenever the user wants to learn, understand, or be taught something rather than have it done for them — "teach me X", "help me learn X", "explain X properly", "give me a learning plan for X", "how should I study X", "学一下 X", "教我 X", "系统学习 X", "帮我搞懂 X", "我想入门 X" — even when they never mention a plan, notes, or questioning. Also use it when the user wants to level up a skill over several sessions instead of asking one question.
  Do not use it for a single lookup or a one-off explanation the user will not build on; answer directly in that case.
---

# Learn

Teach a topic by wiring it into what the user already knows, not by dumping a summary. The deliverable is a changed mental model: the user can derive new results from known ones and connect the new material to things they already use.

Three ideas make this work, and every step below exists to serve one of them:

- **Understanding is a network.** Knowledge is nodes (what is known) plus edges (how it relates). Every node added without an edge is fragile, so each new concept should attach to something already in place and to at least one other new concept.
- **The starting point must be real.** Everything — examples, depth, pacing, what to skip — is relative to where the user actually is. A wrong guess about their level corrupts the entire session, so the guess gets tested before it is used.
- **The goal governs the content.** A session that wanders is a session that teaches nothing well. Material unrelated to the agreed goal is cut, even if it is interesting.

## Workflow

| Step | Output | Gate |
| --- | --- | --- |
| 0. Set up notes | A note skeleton, or a decision not to use notes | User agrees to create notes or not |
| 1. Research the topic | A knowledge framework: concepts and their relations | None; feeds step 2 |
| 2. Agree on the goal | One stated learning goal | User confirms it or writes their own |
| 3. Verify the boundary | A starting point plus a list of what to skip | User confirms after the test questions |
| 4. Plan | Ordered, shallow-to-deep tasks | User confirms or amends |
| 5. Teach and test | One explained task, then a check of it | Every task ends with a check |
| 6. Summarize | A recap of the path and an updated boundary | User confirms the goal is met |

Global rule: never advance past a gate. If the user rejects a proposal, revise it and re-ask; never silently substitute your own goal, boundary, or plan.

### Step 0 — Set up notes

Before teaching anything, ask whether the user wants synced notes for this session. Notes hold the core points, the logical thread of the path, and the record of the check questions. If the user declines, keep everything in the conversation and skip the note steps below.

### Step 1 — Research and build the knowledge framework

Launch several `researcher` subagents in parallel, one per angle, so no major branch of the topic is missed. Useful angles: the standard textbook structure, the practitioner's working model, the common misconceptions, and recent developments if the topic moves.

Then synthesize their briefs into a knowledge framework: the core concepts, the relations between them, and which concepts are entry points versus deep ends. The framework is the source of candidate goals in step 2 and the skeleton of the note in step 0. Keep it visible to the user — an unexplained framework turns step 2 into a quiz about your research rather than a choice about their goal.

### Step 2 — Agree on the goal

Propose a small set of candidate goals drawn from the framework, each stated as a capability rather than a topic ("can read a flame graph and name the hot path", not "learn profiling"). Let the user pick one, modify one, or type their own. Confirm the wording before moving on, because everything downstream is judged against it.

### Step 3 — Verify the boundary

Infer what the user already knows from the current directory: code, notes, configs, documents, and prior work are evidence of experience, and they also indicate what would be redundant to explain.

Treat every inference as a hypothesis, never as fact:

- Turn each one into a concrete test — a short problem or a question they can only answer if the inference holds. Prefer multiple choice for facts and definitions; prefer an open question where you need to see their reasoning.
- Ask about what you plan to skip, not only about what you plan to teach. Wrongly skipping material is the failure a user will not notice until later.
- Ask the user to confirm the resulting boundary explicitly.

If the available evidence cannot support a reliable inference, ask a question instead of filling the gap with an assumption. An invented starting point is worse than an extra question.

### Step 4 — Build the plan

Order the tasks from the verified boundary toward the goal, each building on the last, and state for each task what the user will be able to do afterwards. Cut anything the goal does not need. Present the plan, take amendments, and start only after agreement.

### Step 5 — Teach and test, one task at a time

For each task: explain it with an example anchored in something the user already knows, then test it before moving on.

- A check should require producing something — predicting an outcome, reading a real artifact, explaining a why — not recognizing a phrase.
- When an answer is wrong, locate the specific edge that failed and repair that, rather than re-explaining the whole task.
- When the check reveals the boundary itself was wrong, go back to step 3 and fix the boundary, then step 4 and adjust the plan. Do not push on from a known-bad starting point; everything after it inherits the error.

### Step 6 — Summarize

Once the goal is met, walk the whole path: the starting point, each key node, the relations between them, and what is still unfilled. Write the result back into the boundary so the next session starts from the new level instead of re-testing the old one.

## Notes and materials

Notes live in the current working directory, usually an Obsidian vault, so Obsidian manages and renders them.

- Create the note from the template in `templates/`; if none fits, use the structure in `references/note-structure.md`.
- Show knowledge relations with Mermaid diagrams, laid out top-down so the path reads in teaching order.
- Save SVG or PNG files in `attachments/` and link them from the note rather than inlining them.
- Update the note as each step completes. Notes reconstructed at the end record what you remember, not what the user struggled with — and the struggle is the useful part.
- Record the check questions and the user's answers, including the wrong ones, so the notes double as a record of the boundary.

## Asking questions

- Use `ask_user` for every check and every gate.
- Mostly multiple choice, with a few open-ended questions where reasoning matters. Never true/false: a coin flip produces a signal you cannot interpret.
- One question at a time. A batch of questions yields an answer to whichever one the user found easiest.
- Options should be concrete and on the same axis; do not pad the list with "all of the above" or "other" as filler.

## Style

- Write in the user's language, even though this skill file is in English.
- Avoid hard-to-read decorations such as circled numerals (①, ②) and similar symbols; use plain numbering and bullets.
- Prefer short paragraphs and real examples over long enumerations of features.
