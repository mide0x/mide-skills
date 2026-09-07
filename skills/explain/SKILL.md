---
name: explain
description: Teach a piece of code, a type, a language feature, or a design choice so the person actually understands it. Breaks the thing into its elements, shows what goes wrong without it, then proves how it works with a small runnable example and real compiler or runtime output. Use for /explain, "explain X", "what is X", "what does this do", "why did we do X", "I don't get X", "walk me through X". Not for changing code.
---

# Explain

The person asking has the code in front of them and does not yet understand it. The job is to make it click, not to describe it accurately. Accurate descriptions in the abstract have already failed by the time someone asks twice.

## Language

Speak the way `pstack:bro` speaks: plainly, like one human talking to another, with no jargon. That rule governs every sentence here. Concretely:

- Short sentences. One idea each.
- Every term the reader might not know is defined in the sentence where it first appears, or gets its own entry in the pieces section. `readonly`, `declare`, `symbol`, `middleware`, `factory`: never assume.
- Say "it's a fake" or "it's a lie the compiler believes" when that's the truth. Blunt beats precise.
- Explain plain JavaScript before TypeScript, and runtime before types, whenever the thing has both halves.
- Analogies only if they're exact. A loose analogy costs more than it buys.
- If your last explanation didn't land, do not re-explain it in different words. Switch to a runnable demo immediately.
- Admit what you got wrong or unclear. "I explained it badly" is fine and resets trust.

## Before writing

Read the actual code they asked about, and grep for how it's used, built, and tested. Claims about their codebase get verified first. When a "why" has no recorded reason (no commit body, no doc, no comment), say so plainly before offering the reasoning that makes it defensible anyway.

## Shape of an explanation

Work through these in order. Skip a section only when it genuinely has nothing to say.

### 1. The pieces

Every identifiable element in what they pasted, in the order it appears, one to three plain sentences each. Four middleware lines means four entries. `declare const x: unique symbol` means separate entries for `declare`, `unique symbol`, the square brackets, and the symbol itself. This is where the reader's vocabulary gap gets closed, so err toward more entries, not fewer.

### 2. The problem

What goes wrong without this. Show it as a tiny code example where the bug sails through: the swapped ID that compiles, the unbounded body, the email that gets silently redirected. The reader needs to feel the hole before the fix means anything.

### 3. The demo

Build a small, standalone example that isolates the one mechanism. Not their code, and not a toy so abstract it explains nothing. `deleteUser(postId)` beats `foo(bar)`. Write it to the scratchpad directory and run it. Show:

- the source, trimmed to what matters
- the real output: compiler errors, runtime prints, whatever the mechanism produces
- when compile-time versus runtime is the point, the compiled JavaScript too, so they see what survived and what vanished

Then read the output back to them. Point at the exact error line and say what the compiler was comparing and why it refused. That single step is where most of the understanding happens.

Output rules: never paste output you did not get from running the command. If you could not run it, say so and fall back to section 5's pseudocode. An invented error message teaches a wrong lesson with total confidence.

### 4. How it fits together

The flow. Who builds the thing, who holds it, who calls it, in what order, and when the real side effect actually happens. For anything larger than one mechanism, this is pseudocode of the pieces and the order they talk to each other, with the one runnable demo from section 3 covering the core mechanism that can be isolated.

### 5. Back to their code

Point at where this appears in their real repo, with `file:line`, and name the one detail that's specific to their implementation. The place IDs get minted, the one route that would trip the body limit, the two services that get the mailer. This is what turns a general lesson into a fact about their system.

## Scaling

- **A language feature or type** (branded types, `Object.freeze`, discriminated unions): full demo, always. These are cheap to isolate and the demo is the whole explanation.
- **A configuration value or fact** (a size limit, a flag): verify it, explain what depends on it, explain what breaks if it's wrong. A demo is optional and usually not worth it.
- **A subsystem** (an auth flow, a request pipeline): pseudocode of the fit in section 4, plus a demo of the one mechanism inside it that can stand alone. Do not try to run the whole thing.
- **Something you can't run at all**: say so, then pseudocode. Label it as pseudocode. Never dress pseudocode up as output.

## Running demos

Use the scratchpad directory for every demo file. For TypeScript:

```bash
cd <scratchpad>
npx --prefix <a project with typescript installed> tsc --noEmit --strict --target es2022 demo.ts
```

Run from inside the scratchpad, not from a project root. `tsc` refuses a filename argument when a `tsconfig.json` is in the current directory (error TS5112).

To show what compiles away:

```bash
npx --prefix <project> tsc --target es2022 --outDir out demo.ts
cat out/demo.js
node out/demo.js
```

`tsc` still emits JavaScript when there are type errors. That's useful: you can run the "buggy" version under `node` and show the wrong thing actually happening, which proves the type error was worth having.

Pipe long scratchpad paths through `sed` before showing output, so the reader sees `demo.ts(27,16)` and not forty characters of directory.

## The bar

`reference/branded-types-example.md` is a complete walkthrough that worked: a person had been told three times what a branded type was and still did not get it, then understood it from that example. Match its shape. Pieces first, the bug getting through, real errors, the compiled output with the brand gone, then their own repo.
