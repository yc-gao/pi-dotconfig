---
name: learn
description: >
  Teach a topic to the user with a structured, confirmation-gated learning workflow: research a knowledge framework, agree on learning goals, verify the user's existing cognitive boundary with quiz questions, co-design a progressive plan, then teach step by step with mastery checks and a final recap, optionally writing synchronized Obsidian notes.
  Use this skill whenever the user wants to learn or be taught something — "teach me X", "I want to learn X", "explain X properly", "make me a study plan for X", "help me understand X from scratch", "guide me through X", "how to X", "如何 X" — even if they do not say the word "learn".
  Do not use it for one-off factual questions or quick explanations that need no plan.
---

# Learn

Teach a topic as a guided learning session. The goal is not to deliver information; it is to move the user's
understanding forward along a path they agree to at every step.

## Learning methodology

Understanding beats memorization. Real understanding means being able to derive new knowledge from what is already
known and to connect it to existing knowledge. In the learner's mind **knowledge is not a set of isolated propositions
but a network of nodes and edges**: nodes are pieces of knowledge, edges are the logical relations between them.
Connecting nodes makes new insights emerge, so every teaching move should add either a node the learner can attach to
the existing network or an edge between nodes.

When learning something new, start from existing knowledge and expand the cognitive boundary step by step until the
goal is reached. This lowers the difficulty and makes full use of the learner's potential.

## Hard rules

Violating these breaks the workflow; they are not stylistic preferences.

1. **Gate every phase transition on explicit user confirmation.** Never go from framework to goal, goal to boundary,
   boundary to plan, or plan to teaching without the user agreeing.
2. **Never accept inferred knowledge as fact.** What you infer from files in the working directory is a hypothesis. It
   enters the cognitive boundary only after the user confirms it.
3. **Do not fill gaps with assumptions.** If the available evidence is not enough to judge reliably, ask the user.
4. **One question per `ask_user` call.** Ask exactly one thing.
5. **No redundant content.** Every lesson item must serve the agreed goal and the confirmed starting point.
6. **No true/false questions.** Prefer multiple choice, plus a small number of open questions.

## Teaching workflow

### 1. Research a knowledge framework

Use the `researcher` agent (through the `subagent` tool) to search from several different angles in parallel, then
merge the results into one knowledge framework. Only then continue to the next step.

Cover at least: the main concepts, how they depend on each other, the common misconceptions, and the natural
progression from entry point to goal.

```js
tasks: [
  { agent: "researcher", task: "Angle A: foundational concepts and definitions of <topic>" },
  { agent: "researcher", task: "Angle B: how practitioners actually learn and use <topic>; common pitfalls" },
  { agent: "researcher", task: "Angle C: required prior knowledge and the typical learning path" }
]
```

Write the framework down before talking to the user. It is the raw material for the goal candidates and the question
bank; it is not the teaching material itself.

### 2. Define the learning goal

Derive a small set of candidate goals from the framework and present them with `ask_user` as multiple choice. The user
picks one, or rejects all of them and types their own goal. Resolve ambiguity that would change the plan in the same
round. Continue only after both sides agree on the goal.

### 3. Confirm the cognitive boundary

Infer what the user already knows, has experienced, and has mastered from the files and context of the current working
directory. That inference defines the starting point and tells you what **not** to teach again.

Then validate it: design quiz questions that probe exactly the inferences you made and ask them one at a time with
`ask_user`, confirming each inference before adding it to the boundary. Where evidence is too thin to form a
hypothesis, ask the user directly instead of guessing.

State the boundary as a short explicit list: *known and mastered*, *partially known*, *unknown*, and *explicitly out of
scope*.

### 4. Build the learning plan

Design the plan from the confirmed boundary toward the agreed goal: shallow to deep, each step building on a previous
node, always centered on the goal, with nothing redundant. For each step state the concept, why it comes at that
point, and what the user should be able to do afterwards.

Present the plan with `ask_user` for approval and iterate on requested adjustments. Do not start teaching before the
plan is approved.

### 5. Teach step by step

Work through the plan one step at a time. After each learning task, ask questions that test mastery of that step and
use the answers to correct misunderstandings. The aim is to detect and repair a wrong edge in the knowledge network,
not to score the user.

If an answer shows that the boundary was wrong (something assumed known is not), say so, update the boundary, and
adjust the remaining plan before continuing.

### 6. Summarize the path

Once the goal is reached, recap the entire learning path: the nodes covered, the relations between them, where the
user's understanding changed, and what to explore next. Present it as a connected path network rather than a bare
chronological list of topics.

## Format and interaction

**Before starting the session, ask the user whether to create synchronized notes.** Do not create them unasked.

Synchronized notes record the core knowledge points, the logical structure, and the question-and-answer results of the
mastery checks. They live in the current directory (usually an Obsidian vault) and are managed and displayed by
Obsidian. Create them from the templates in `templates/`; if no template fits, ask the user instead of inventing one.

- Use Mermaid or similar diagrams to show knowledge relations visually, with a top-down layout whenever possible.
- When an SVG or PNG is needed, save it under `attachments/` and reference it from the note.
- Avoid hard-to-read characters such as ①; keep the text plainly readable.
- Ask questions with `ask_user`: mostly multiple choice, a few open questions, no true/false, one question per call.

## Anti-patterns

- Dumping a full explanation before the goal and boundary are confirmed.
- Teaching what the user already knows, or skipping a prerequisite you only assumed.
- Running the mastery check as a formality and then ignoring a wrong answer.
- Expanding the plan with "nice to have" topics that drift away from the agreed goal.
- Inferring the cognitive boundary from files and never verifying it.

## Authoring constraint

Keep this skill file itself written in English.
