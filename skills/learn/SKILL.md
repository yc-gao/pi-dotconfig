---
name: learn
description: >
  Teach a topic to the user with a structured, confirmation-gated learning workflow: research a knowledge framework, agree on learning goals, verify the user's existing cognitive boundary with quiz questions, co-design a progressive plan, then teach step by step with mastery checks and a final recap, optionally writing synchronized Obsidian notes.
  Use this skill whenever the user wants to learn or be taught something — "teach me X", "I want to learn X", "explain X properly", "make me a study plan for X", "help me understand X from scratch", "guide me through X" — even if they do not say the word "learn".
  Do not use it for one-off factual questions or quick explanations that need no plan.
---

# Learn

A skill for teaching a topic to the user as a guided learning session. The goal is not to deliver information; it is to
move the user's understanding forward along a path they agree to at every step.

## Core principle

Understanding beats memorization. Real understanding means being able to derive new knowledge from what is already
known and to connect it to existing knowledge. In the learner's mind **knowledge is not a set of isolated propositions
but a network of nodes and edges**: nodes are pieces of knowledge, edges are their logical relations. Connecting nodes
produces new insights, so every teaching move should either add a node the learner can attach to the existing network
or add an edge between nodes.

Therefore: start from what the user already knows, expand the cognitive boundary incrementally, and always keep the
final goal in view. This lowers difficulty and makes the learning potential reachable.

## Hard rules

These are not stylistic preferences. Violating them breaks the workflow.

1. **Gate every phase transition on user confirmation.** Never move from framework to goal, goal to boundary,
   boundary to plan, or plan to teaching without an explicit agreement from the user.
2. **Never accept inferred knowledge as fact.** What you infer from the files in the working directory is a hypothesis.
   It becomes part of the cognitive boundary only after the user confirms it.
3. **Do not fill gaps with assumptions.** If the available evidence is not enough to judge reliably, ask the user.
4. **One question at a time.** Each `ask_user` call asks exactly one thing.
5. **No redundant content.** Every lesson item must serve the agreed goal and the confirmed starting point.
6. **No judgment (true/false) questions.** Use multiple choice primarily, plus a small number of open questions.

## Workflow

### 1. Research a knowledge framework

Delegate to the `researcher` agent (via the `subagent` tool) and run several angles in parallel, one angle per child,
then merge the outputs into a single knowledge framework: the main concepts, how they depend on each other, the
common misconceptions, and the natural progression from entry point to goal.

```js
// sketch: run angles in parallel, merge afterwards
tasks: [
  { agent: "researcher", task: "Angle A: foundational concepts and definitions of <topic>" },
  { agent: "researcher", task: "Angle B: how practitioners actually learn/use <topic>; common pitfalls" },
  { agent: "researcher", task: "Angle C: prior knowledge required and typical learning path" }
]
```

Write the framework down before talking to the user. It is the raw material for both the goal candidates and the
question bank; it is not the teaching material itself.

### 2. Define the learning goal

Derive a small set of candidate goals from the framework and present them with `ask_user` (multiple choice). Let the
user pick one, or reject all of them and type their own goal. Clarify scope in the same round only if the goal is
ambiguous in a way that changes the plan. Only when both sides agree on the goal does the session continue.

### 3. Confirm the cognitive boundary

Infer what the user already knows, has experienced, and has mastered from the files and context of the current working
directory. That inference defines the starting point and tells you what **not** to teach again.

Then validate it. Design quiz questions that probe exactly the inferences you made, and ask them one at a time with
`ask_user`. Confirm each inference with the user before adding it to the boundary. Where the evidence is too thin to
even form a hypothesis, ask the user directly instead of guessing.

The boundary statement is a short, explicit list: *known and mastered*, *partially known*, *unknown*, plus
*explicitly out of scope*.

### 4. Build the learning plan

Design the plan from the confirmed boundary toward the agreed goal: shallow to deep, each step building on the previous
node, nothing that does not serve the goal. For each step state the concept, why it comes here, and what the user
should be able to do afterwards.

Present the plan with `ask_user` for approval. Accept adjustments and iterate until both sides agree. Do not start
teaching before the plan is approved.

### 5. Teach step by step

Work through the plan one step at a time. After each step, ask questions designed to test mastery of that step and use
the answers to correct misunderstandings — the goal is to detect and repair a wrong edge in the knowledge network, not
to score the user.

If an answer reveals that the boundary was wrong (something assumed known is not), say so, update the boundary, and
adjust the remaining plan before continuing.

### 6. Summarize the path

When the goal is reached, recap the whole learning path: the nodes covered, the relations between them, where the
user's understanding changed, and what to explore next. Present it as a network, not a chronological list of topics.

## Notes and interaction format

**Before starting the session, ask whether to create synchronized notes.** Do not create them unasked.

Synchronized notes record the core knowledge points, the logical structure, and the question-and-answer results of the
mastery checks. They live in the current directory (usually an Obsidian vault) and are managed and displayed by
Obsidian; create them from the templates in `templates/`.

- Use Mermaid and similar diagrams to show knowledge relations visually, with a top-down layout whenever possible.
- When an SVG or PNG is needed, save the file in `attachments/` and reference it from the note.
- Avoid hard-to-read characters such as ①; keep the text plainly readable.

Questions during the session always go through `ask_user`, mostly as multiple-choice with a few open questions, one
question per call.

## Anti-patterns

- Dumping a full explanation before the goal and boundary are confirmed.
- Teaching what the user already knows, or skipping a prerequisite you only assumed.
- Running the mastery check as a formality and then ignoring a wrong answer.
- Expanding the plan with "nice to have" topics that drift away from the agreed goal.
- Inferring the cognitive boundary from files and never verifying it.
