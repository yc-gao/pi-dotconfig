---
name: learning-guide
description: >
  Teach a topic to a user through an interactive, one-on-one lesson.
  Use when the user asks to learn, understand, or be taught a topic ("teach me X",
  "explain X to me", "help me understand X", "walk me through X", "how to X", "如何", "理解", "学习"), or says
  they want to really get how something works.
  Not for quick factual lookups or one-line definitions.
---

# Learning guide

Run a lesson as a guided build-up, not a lecture dump. Nothing is explained
until the map, the goal, the boundary and the plan are settled with the user,
and the lesson closes by retracing the path that was walked.

## Core principles

### Understanding over memorization

True understanding means the learner can derive new knowledge from what they
already know. In a learner's mind, knowledge is not a pile of isolated
propositions but a network: nodes are concepts, edges are the logical
relationships between them. Even if a node is missing — forgotten, never
learned — it can be rebuilt by following the edges out of the nodes that
remain.

So every teaching step must start from existing knowledge and extend the
network one node or edge at a time, until the target is reached. A lesson that
adds isolated facts adds no edges, and those facts will not survive.

### Build outward from the cognitive boundary

Before adding any new node or edge, locate the learner's cognitive boundary:
the edge of what they currently understand. Knowledge derived from that
boundary is the knowledge that sticks. Knowledge delivered from somewhere else
is noise, however correct it is.

## Workflow

The phases are ordered and all of them are required. The step most often
forgotten is Phase 1 — do not start from the goal, start from the map.

```
0. offer synchronized notes               (user decides)
1. researchers search in parallel, merge all briefs, build the framework,
   split stages
2. read the project files, locate the cognitive boundary, settle the goal
                                          (user decides)
3. agree on the learning plan             (iterate until consensus)
4. teach stage by stage, checking after each task
5. summarize and retrace the learning path (once the goal is reached)
```

Each phase ends in an explicit gate: the research is merged and summarized
before the boundary is probed, the goal and boundary are settled before the
plan is drawn, and the plan is agreed before the first explanation.

Keep the big picture: the framework from Phase 1 stays the backbone. Goals,
boundary checks, stages and the plan are all read off that framework, and
teaching follows it edge by edge.

### Phase 0 — Offer synchronized notes

Before anything else, ask the user whether they want notes kept in sync while
learning. Use `ask_user` with multiple-choice options, for example:

- Keep synchronized notes in my Obsidian vault.
- No notes, just the conversation.

Where the notes live: inside the user's Obsidian vault, displayed by Obsidian.
When notes are synchronized, the notes are the primary display — the
conversation explains and the vault shows. Complex visuals live there:
Mermaid diagrams, canvases, graph views, tables, and generated image files
referenced from the notes. Generated images go under the vault's
`attachments` path and are referenced from the note by relative link, so the
vault stays portable. If none of the richer formats fits, fall back to writing
a raw SVG file into the vault; Obsidian renders it too. If the user
says yes, create and keep updating the notes as the lesson advances: framework
and stages, the agreed plan, each new node and edge, open questions, and
misunderstandings that were corrected. If the user says no, never write notes
and never generate diagram files; keep everything in the conversation.

### Phase 1 — Build the framework in parallel, then split stages

Build the map the rest of the lesson hangs on. Ground the subject with two
kinds of sources before drawing anything:

1. Delegate the subject research to several `researcher` subagents running in
   parallel, one per research angle, via one `subagent` call with
   `workflow: "parallel"` and a `tasks` array. Do not run the angles one after
   another, and do not send a single generic brief.

   The angles execute concurrently and the phase is synchronous: wait until
   every child has reported, then merge. Do not draw a partial map from the
   briefs that land first, and do not move on to Phase 2 while a search is
   still running.

   Pick 2-4 angles that genuinely differ, for example:

   - foundations: the concepts the topic is built from and their logical order
   - authoritative reference: textbook, official docs, canonical curriculum
   - practice: hands-on experience, common misconceptions, pitfalls
   - current state: recent developments, when the topic is time-sensitive

   Ask each child for a sourced brief: the concepts involved (nodes), how they
   relate (edges), the prerequisite order, and a suggested split into learning
   stages. Every child writes its own brief; they do not coordinate.

   Prefer the subagents over researching inline, so the framework rests on
   checked sources rather than memory. `researcher` needs the web tools
   (`web_search`, `fetch_content`, `source_check`); launch them as background
   children so the ambient web-access extension loads. If the subagents or
   their web tools are unavailable, run the same angles in parallel inline
   with the web tools and say so.

   Then merge the briefs into one framework: sort the material into a
   knowledge thread — what follows from what, and in which order it has to be
   learned — and keep the nodes and edges the angles agree on. Carry
   contradictions forward to the user instead of silently picking one, and
   state which sources each part rests on. Report the merged result before
   asking the user anything.

2. In parallel, search the project files — repository, docs, code,
   configuration — for how the subject actually shows up in the user's own
   context. The web keeps the map correct; the project keeps it relevant. Do
   not wait for the research children before starting this search.

From those sources:

3. Retrieve the knowledge network: the concepts involved (nodes) and the
   logical relations between them (edges).
4. Sketch the framework: the map of nodes and edges covering the target
   concept, and where the target sits inside it.
5. Split that framework into learning stages — a few coherent chunks that can
   each be taught and checked as a unit. Stages are the unit for Phase 4 and
   Phase 5; the edges inside a stage stay individual steps.

Never skip this phase and never replace it with a list of isolated facts. It
keeps the lesson grounded in a map, and it gives the later phases something to
refer to.

### Phase 2 — Read the project, locate the boundary, settle the goal

Three things happen here in this order, and the phase closes only when the
user has agreed to the goal and the boundary. Neither is assumed.

**1. Read the project.** Search the project's files for how the subject
actually shows up in the user's own context — code, configuration, docs,
notes, earlier conversation. This is evidence about the learner, not about the
topic.

**2. Locate the boundary.** Find out what the user already knows and where
their understanding stops:

1. Start from the evidence just gathered, the sources read in Phase 1, and
   the user's earlier conversation.
2. Then probe with `ask_user`: present candidate starting points read off the
   framework and let the user say which ones they already hold, and where they
   start to feel unsure.

Do not assume the boundary; find it. It is the launch point for all teaching
that follows.

**3. Settle the goal.** Read the plausible goals off the framework and the
boundary just located, guess 3-5 of them, and ask the user to pick one or
state their own. Use `ask_user` with multiple-choice options.

Then restate both back in one short message — boundary here, goal there — and
wait for agreement before Phase 3.

### Phase 3 — Propose the learning plan and reach consensus

1. Draw the plan as a diagram: the path from the boundary to the goal along
   the framework, listing each stage and the steps (new nodes and edges)
   inside it, in order.
2. The plan must spread outward from the boundary: every step reachable from
   the previous one, nothing introduced before its prerequisites. Never jump
   ahead of the boundary because a concept is important, and never introduce
   material that is too hard to build from what the learner holds.
3. The plan must always move toward the agreed goal: cut anything that is only
   tangential, no matter how interesting or how much it belongs to the
   framework.
4. Present the plan and iterate: adjust on feedback, re-present, repeat until
   the user agrees. Keep communicating until consensus is reached, and do not
   teach anything before it is explicit.

### Phase 4 — Teach stage by stage, checking understanding

Advance along the agreed path, one stage at a time. Each step inside a stage:

- Builds the new node or edge directly from what the user already
  understands.
- Explains the logical relationship, not only the fact, so the new knowledge
  joins the network instead of floating beside it.
- Uses a diagram whenever structure, relationships or a path are involved.

After finishing each learning task — each stage, not only at the very end:

- Design questions via `ask_user` to confirm what was actually learned.
- Prefer questions that require reasoning (can the user derive the next node
  from what they now hold?) over recall of facts.
- Correct each misunderstanding one at a time: re-explain from the node the
  learner actually holds, then continue.
- Update the notes if the user opted in.
- Only move to the next stage once the current one is confirmed.

### Phase 5 — Summarize and retrace the learning path

Once the goal is reached, close the lesson by summarizing. Reconstruct the
path that was walked: where the learner started, which nodes and edges were
added in order, and why each one followed from the previous. Make the shape of
the new network visible — the learner should see how the goal can now be
derived from what they already understood at the start. Fold the summary into
the notes if the user opted in.

## Interaction rules

- **One question per message.** Never bundle several questions together.
- **Use `ask_user`** for every question.
- **Mostly multiple choice**, with a few short open-ended questions; **never
  yes/no or true/false questions** — they reveal little about understanding.
- **Big picture first.** Research the sources, draw the framework, then ask
  about goals or boundaries.
- **The user owns the goal.** Offer candidates, do not decide.
- **Agree before teaching.** No explanation until the plan is confirmed.

## Format and readability

- **Diagrams over prose** for structure, relationships and paths. Pair
  explanations with visuals wherever a picture carries the idea better than a
  paragraph.
- Keep every diagram line at or under 120 characters so it never wraps.
- Avoid hard-to-distinguish symbols — circled numbers such as ① ② ③,
  full-width glyphs, decorative marks. Use plain numbering (`1.` `2.` `3.`),
  bullet lists, or tables instead.
- Leave a blank line before and after every diagram or table block.

## Diagram options

ASCII trees for hierarchy, node-edge graphs for the knowledge network, arrow
chains for causal or derivation paths, tables for comparisons. In Obsidian
notes, richer visuals are available: Mermaid blocks for graphs and flows,
canvases, and image files you generate for the lesson and reference from the
note. Raw SVG is the fallback when a richer format cannot express the diagram.

## Example flow

1. User: "I want to learn how transformers work."
2. Agent asks via `ask_user` whether to keep synchronized notes in the
   Obsidian vault.
3. Agent launches several `researcher` children in parallel — foundations,
   authoritative reference, practice — while searching the project files for
   how transformers appear in the user's own code. It waits for every child,
   then merges the briefs into one framework (vectors → similarity → attention
   → self-attention → transformers) split into stages such as "representing
   meaning", "attention", "transformer blocks".
4. Agent asks one boundary question, e.g. "Which of these do you already
   understand well?" with options such as vectors and embeddings, dot
   products, neural networks, all of them.
5. Agent then proposes candidate goals via `ask_user`, chosen against that
   boundary, e.g.:
   - Understand attention well enough to read a paper.
   - Grasp the intuition only, no math.
   - Implement a minimal transformer.
6. User picks one, and the agent restates the boundary plus the goal to get
   explicit agreement.
7. Agent draws the plan, presents it, adjusts on feedback, and repeats until
   the user agrees:

   ```
   boundary: vector embeddings
     1. representing meaning
        └─ dot-product similarity
     2. attention
        └─ attention weights
     3. transformer blocks
        └─ self-attention
             └─ multi-head attention   <- goal
   ```

8. Agent teaches stage 1, one node per step, with diagrams, updating the notes
   if the user opted in.
9. After stage 1 the agent asks one reasoning question that requires deriving
   the next node, corrects the misunderstanding it reveals, then continues to
   stage 2.
10. Once the goal is reached, the agent summarizes the lesson by retracing the
    path from vector embeddings to multi-head attention, showing how each node
    followed from the previous one.
