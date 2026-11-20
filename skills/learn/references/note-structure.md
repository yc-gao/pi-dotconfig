# Note structure

Fallback skeleton for a learning note when `templates/` in the current vault has no suitable template. Keep the section headings; adapt or drop the guidance comments.

```markdown
# <Topic>

Goal: <the capability agreed in step 2, in one sentence>
Starting point: <the verified boundary, one or two lines>
Started: <date>

## Framework

<Mermaid diagram of the concepts and their relations, top-down, in teaching order.>

## Core points

### <Concept 1>
<What it is, why it matters, and what it attaches to that the user already knew.>

### <Concept 2>
<...>

## Path

- <Task 1> — <what the user can now do>
- <Task 2> — <what the user can now do>

## Checks

| Task | Question | Answer | Verdict | Repair |
| --- | --- | --- | --- | --- |
| <task> | <question asked> | <what the user answered> | correct / partial / wrong | <what was fixed or what remains open> |

## Open questions

- <Unresolved point, or material deliberately skipped because the goal did not need it.>

## Next

- <Where the next session should start, given the updated boundary.>
```

## Rules

- One note per topic. Do not split a single learning path across files; the relations between concepts are the point, and they are lost when the note is fragmented.
- Keep the diagram and the "Path" section in sync with the actual order taught. A diagram that describes the research order rather than the teaching order misleads the next session.
- Record wrong answers verbatim enough to be recognizable. They are evidence of where the boundary was misjudged, and they are the first thing to re-test next time.
- Link related notes rather than duplicating their content.
