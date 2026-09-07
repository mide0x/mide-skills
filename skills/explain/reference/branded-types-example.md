# Worked example: branded types

The question, after two failed abstract explanations:

> I still don't get it. Just use an example. It doesn't need to be from my codebase.

The original code being asked about:

```ts
declare const authDomainBrand: unique symbol;

export type ChallengeId = string & {
  readonly [authDomainBrand]: "ChallengeId";
};
export type SessionId = string & {
  readonly [authDomainBrand]: "SessionId";
};
```

## 1. The pieces (given one turn earlier, in plain JavaScript first)

**A symbol is a weird kind of property name.** Normally object keys are strings. A symbol is the other option, and every one you make is one of a kind:

```js
const a = Symbol("hello");
const b = Symbol("hello");
a === b; // false
```

**Square brackets mean "the key isn't the word I typed, it's whatever this thing holds."**

```js
const key = Symbol("secret");
const obj  = { key: "one" };    // the key is the word "key"
const obj2 = { [key]: "two" };  // the key is that symbol
```

**`unique symbol`** as a type means "this exact one, and nothing else." Plain `symbol` would mean "any symbol", which is useless here because then any symbol would satisfy the brand.

**`declare`** means "take my word that this exists, don't create it." The line produces no JavaScript. Combined with the above, the symbol is never actually made. It's a name only the type checker knows about. So no object can ever genuinely have that property, because the key it would need doesn't exist.

## 2. The problem

```ts
function deleteUser(id: string) { ... }

const postId = "post_456";

deleteUser(postId);   // compiles fine. deletes the wrong thing.
```

TypeScript has no complaint, because it's true: a post ID *is* a string.

## 3. The demo

File written to the scratchpad as `demo.ts`:

```ts
// PART 1: plain strings. the bug gets through.
function deleteUser(id: string) {
  console.log("deleting user", id);
}
const plainPostId = "post_456";
deleteUser(plainPostId);            // line 11: compiles. wrong thing deleted.

// PART 2: same thing, branded
declare const brand: unique symbol;

type UserId = string & { readonly [brand]: "UserId" };
type PostId = string & { readonly [brand]: "PostId" };

function deleteUserSafe(id: UserId) {
  console.log("deleting user", id);
}

const userId = "user_123" as UserId;
const postId = "post_456" as PostId;

deleteUserSafe(postId);       // line 27
deleteUserSafe("user_123");   // line 28
deleteUserSafe(userId);       // line 29: fine

// still a string in every other way:
console.log(userId.toUpperCase());
console.log(`hi ${userId}`);
console.log(userId === "user_123");
```

Commands run:

```bash
cd <scratchpad>
npx --prefix <project> tsc --noEmit --strict --target es2022 demo.ts
npx --prefix <project> tsc --target es2022 --outDir out demo.ts
cat out/demo.js
node out/demo.js
```

Actual compiler output:

```
demo.ts(27,16): error TS2345: Argument of type 'PostId' is not assignable to parameter of type 'UserId'.
  Type 'PostId' is not assignable to type '{ readonly [brand]: "UserId"; }'.
    Types of property '[brand]' are incompatible.
      Type '"PostId"' is not assignable to type '"UserId"'.
demo.ts(28,16): error TS2345: Argument of type 'string' is not assignable to parameter of type 'UserId'.
  Type 'string' is not assignable to type '{ readonly [brand]: "UserId"; }'.
```

Reading it back: TypeScript compared the two marker labels, saw `"PostId"` where it wanted `"UserId"`, and refused. That is the whole mechanism. The marker exists purely so the two types have something to disagree about. Without it they're both `string` and there is nothing to compare. The second error is the other half: a raw string can't get in either, so nothing enters without passing through wherever these get minted on purpose.

Actual compiled JavaScript, part 2:

```js
function deleteUserSafe(id) {
    console.log("deleting user", id);
}
const userId = "user_123";
const postId = "post_456";
deleteUserSafe(postId);
deleteUserSafe("user_123");
deleteUserSafe(userId);
```

The `declare const brand` line, both type declarations, and both `as` casts have all vanished. The compiled code is what you'd have written with plain strings. Nothing is added to the values, nothing is checked while it runs, no cost.

Running it under `node` printed `deleting user post_456` on the first line, which is the bug actually happening. That's the proof the type error was worth having.

## 4. How it fits together

The restriction goes one way. A branded ID works anywhere a plain string works: log it, compare it, put it in a URL. A plain string will not be accepted where a branded ID is wanted. All the convenience of a string, with a gate on the way in.

## 5. Back to their code

The gate in their repo is `apps/api/src/modules/auth/repository.ts:28`:

```ts
const sessionId = z.uuid().transform((value) => value as SessionId);
```

The only way to mint a session ID is to push a value through that check. It has to be a genuine UUID first. The cast at the end is not a shortcut past the type system, it's the reward for having proved the value is real. So anywhere in the code that holds a session ID, you know without looking that it came from validation.

## Why this one worked when the theory didn't

- Plain JavaScript first, with runnable one-liners for `Symbol` and computed keys, before any TypeScript.
- The bug was shown sailing through before the fix was shown.
- The error messages were real, and were read line by line.
- The compiled output made "it doesn't exist at runtime" visible instead of asserted.
- It ended on their own file and line.
