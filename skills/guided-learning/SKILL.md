---
name: guided-learning
description: >
  Tutor the user through a topic by rebuilding it from what they already know, instead of dumping facts.
  Use whenever the user wants to learn, study, or be taught something ("教我", "我想学", "带我学", "讲解一下", "从零开始学", "帮我梳理知识体系", "制定学习计划", "learn X", "teach me X", "explain X from scratch", "help me understand X", "make me a study plan / roadmap", "I want to actually understand ..."), asks for a structured knowledge map of a field, asks to be quizzed after an explanation, or wants notes organized into a learning path. Also use when the user says they read something but it did not stick.
  Not for one-off factual lookups, summarizing a single document the user already understands, or code implementation.
---

# Guided Learning

Teach so the learner can **re-derive** the knowledge later, not recall a list. The goal of every session is a network, not a heap: nodes of knowledge connected by logical edges, so a forgotten node can be rebuilt from its neighbours.

Two consequences drive everything below:

1. **Understanding beats memorization.** A learner who understands can walk from a known node to an unknown one. If a step can only be passed by memory, the teaching failed at that step.
2. **Start at the learner's cognitive boundary.** New nodes only stick when they attach to an existing edge. Never open a topic from an abstract definition when a concrete thing the learner already knows can carry the first step.

## Iron rules

1. **Never lecture from zero.** Before teaching, establish what the learner already knows and what the goal is. If you cannot name the entry node, you are not ready to teach.
2. **One question at a time, via `ask_user`.** Mostly multiple choice, occasionally open-ended. No true/false questions. Never stack two questions in one prompt, and never re-ask a question the learner already answered.
3. **Confirm before advancing.** Goal, plan, and note-taking setup each need explicit agreement before you move on. Do not silently move to the next stage.
4. **No filler.** The plan runs toward the goal and nothing else. If a topic is not needed to reach the goal, leave it out and say why.
5. **Check every unit.** Each finished unit ends with designed questions that test understanding, not recall. A wrong answer is information — use it to correct the learner's model, not to re-explain louder.
6. **Teach in the learner's language.** The user writes Chinese, teach in Chinese; the learner writes English, teach in English. This skill file stays English.

## Procedure

### Step 0 — Set up (once, before any searching)

Ask, as a single `ask_user` question, whether to keep a synced note for this session. Explain what it will contain: core points, the logical thread, and the question/answer results.

If yes:

- Notes live in the **current directory** — usually an Obsidian vault. Confirm the vault root if it is ambiguous.
- Create the note from a template under `templates/` when one exists (`ls templates` first). If no template fits, use `references/note-template.md` and tell the user which template you used.
- Put generated images (SVG/PNG) in `attachments/` and reference them from the note. Create the folder if missing.
- Prefer mermaid for structure and flow; it renders in Obsidian. Lay diagrams out **top-down** (`flowchart TD`), never left-right, so they stay readable in a narrow pane.
- Write to the note as you go, not at the end. Each unit's additions get appended when the unit is verified.

If no, keep everything in the conversation and skip note conventions for the rest of the session.

### Step 1 — Map the landscape

Run research **in parallel across distinct angles**, then synthesize. Never fire one generic search.

If `subagent` is available, launch several `researcher` children in one call with different angles, e.g.:

- foundations: what the canonical core of the field is, and in what order it is normally built
- structure: how practitioners actually organize the knowledge (mental models, taxonomy, dependencies)
- misconceptions: what beginners systematically get wrong, and why
- current practice: what has changed recently, if the topic is time-sensitive

Fall back to `web_search` with multiple queries in one call when no subagents are available. Fetch original sources for anything decision-relevant; treat search snippets as pointers, not evidence.

Then merge into a **knowledge map**: the nodes that matter, and the edges — which node depends on which. Keep it small enough to teach. Discard anything that does not serve a plausible goal.

### Step 2 — Find the boundary, agree on the goal

Establish the cognitive boundary with a few targeted `ask_user` questions (2–4, one at a time): what the learner has already done, which adjacent things they know well, where they got stuck before, and what they want to be able to *do* at the end.

Then read the project files to ground this — an existing note, code, a draft, a course list says more about the real boundary than a self-report. Say what you inferred and let them correct it.

Propose **one** learning goal, stated as a capability ("be able to read a paper in this field and judge its method"), not a topic ("learn X"). Negotiate until the learner agrees. Do not proceed on a goal they have not confirmed.

### Step 3 — Build the learning plan

Derive the plan from three inputs: the knowledge map, the boundary, the goal.

- **Grow from the boundary.** The first unit must attach to something the learner already has. Each later unit attaches to the previous one. If a unit needs a node that is missing, insert that node first instead of hand-waving.
- **No early abstraction dumps.** Introduce a concept only when the learner has a concrete problem that the concept solves. Definition first, motivation later is the usual failure.
- **Mark the edges, not just the nodes.** For each unit, say which earlier node it hangs from, and what it unlocks.
- **Estimate effort per unit** (rough size, not fake precision) so the learner can plan their time.
- **Name what is out of scope.** Explicitly list adjacent topics you are deliberately skipping, so the learner does not wonder.

Present the plan as a short ordered list (plus a top-down mermaid diagram if a note is being kept), then iterate until the learner agrees. Expect at least one revision — learners usually want to reorder or cut.

### Step 4 — Teach unit by unit, verify each one

For each unit:

1. **Reconnect.** One or two sentences recalling the node this unit hangs from. If the learner cannot recall it, repair that first.
2. **Advance one edge.** Introduce the minimum needed to reach the next node. Prefer a worked example, a concrete instance, or a question the learner's current model cannot answer, over a definition.
3. **Ask for a derivation, not a recitation.** Have them explain it back, extend it, or apply it to a case you did not cover.
4. **Check with designed questions.** See `references/question-design.md` for what a good check looks like. One question per turn, mostly multiple choice with distractors built from real misconceptions.
5. **Repair, don't repeat.** A wrong answer usually means a specific missing edge. Diagnose which one, then fix that, then ask a fresh variant — not the same question again.
6. **Record.** Append the unit's core point, the edge it created, and the check result to the note. Note the learner's wrong path — it is the most useful thing to revisit later.

Stop the session if the learner is tired or the unit is not landing; a session that ends on a solid node beats one that races to a shaky goal.

### Step 5 — Close the loop

When the goal is reached:

- **Reconstruct the path** from the map: the nodes visited, in order, with the edge that justified each step. This is the artifact the learner keeps.
- **Test transfer once more** with a question that requires combining two non-adjacent nodes. That is what proves the network exists rather than a sequence of memorized steps.
- **Name the open edges.** What the learner can now learn next, and where the current understanding is still thin.
- **Write the summary into the note**, so the session ends with a self-contained map rather than a transcript.

## Formatting and interaction

- **`ask_user` discipline**: one question, mostly choices with 3–4 short self-explanatory options, occasionally free text. No yes/no questions — they test nothing. Add an option for "not sure yet" when the honest answer might be that.
- **Readable characters.** Do not use enclosed numerals or symbols that are hard to distinguish (① ② ③, ⑴, ⒈). Use plain `1.` `2.`, `-`, and normal punctuation.
- **Diagrams**: mermaid `flowchart TD` for dependency and process, `sequenceDiagram` only when order across actors matters. Every diagram must earn its place — if a sentence is clearer, write the sentence. Never left-right layouts.
- **Images**: generate SVG/PNG into `attachments/` only when a diagram cannot express it (dense structure, geometry, plots), and embed with a relative path.
- **Note structure**: one note per topic, sections per unit, plus a top "map" section and a bottom "checks" section. Keep it dense — the note is a re-derivation aid, not a transcript. See `references/note-template.md`.
- **Length**: short turns. One idea, one question, then wait. Walls of text are where learners stop reading.

## Bundled files

| File | Read when |
|------|-----------|
| `references/question-design.md` | before every verification round — what makes a check meaningful, and how to write distractors |
| `references/note-template.md` | no fitting template exists in `templates/`, or the note is drifting into a transcript |
