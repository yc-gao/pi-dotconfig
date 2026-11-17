# C++ Design Guide

Design guidance for **C++20-and-later** codebases, derived from the [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) (Stroustrup & Sutter). Read this during planning: it settles the decisions that are expensive to reverse — ownership and lifetime model, error strategy, interface contracts, class hierarchy shape, and concurrency model.

> This is a **design** guide (read before writing code). For reviewing existing C++, use the `code-review` skill's [C++ Guide](../../code-review/reference/cpp.md).
> Rule IDs below (`C.21`, `R.30`, `F.16`, …) are the Core Guidelines' own identifiers so a reviewer or a static-analysis report can be traced back to the source rule. Where the guidelines are silent or stale, this guide says so explicitly.

## Contents

- [How to use the guidelines](#how-to-use-the-guidelines)
- [Questions to answer before designing](#questions-to-answer-before-designing)
- [Baseline: express intent, be statically type-safe](#baseline-express-intent-be-statically-type-safe)
- [Ownership and lifetime model](#ownership-and-lifetime-model)
- [Special members: the rule of zero and five](#special-members-the-rule-of-zero-and-five)
- [Parameter and return design](#parameter-and-return-design)
- [Error handling strategy](#error-handling-strategy)
- [Class and hierarchy design](#class-and-hierarchy-design)
- [Function and interface design](#function-and-interface-design)
- [Concurrency design](#concurrency-design)
- [Performance design](#performance-design)
- [Headers, modules, and ABI](#headers-modules-and-abi)
- [Testing design](#testing-design)
- [Anti-pattern quick reference](#anti-pattern-quick-reference)
- [Design review checklist](#design-review-checklist)

---

## How to use the guidelines

The guidelines are a few hundred rules; a design review cannot walk them all. Use them in this order:

1. **Profiles pick the subset that matters.** Choose the profiles the project claims: *type safety*, *bounds safety*, *lifetime safety*. Record the choice in the plan — it converts vague "we care about safety" into checkable rules (no pointer arithmetic, no `reinterpret_cast`, no narrowing, no dangling views).
2. **Static analysis enforces what review forgets.** `clang-tidy` with `cppcoreguidelines-*`, `bugprone-*`, `modernize-*`, `performance-*`, plus `-Wall -Wextra -Wconversion -Wshadow -Wnon-virtual-dtor`. Design decisions that the analyzer can enforce are decisions that stay true.
3. **Sanitizers turn lifetime bugs into test failures.** ASan + UBSan in the regular test build, TSan for any code touching shared state. A design that cannot be run under sanitizers is not verified.
4. **GSL is the vocabulary for contracts.** `gsl::owner`, `gsl::not_null`, `gsl::span` (or `std::span` in C++20), `gsl::zstring`, `gsl::index`, `gsl::finally`, `Expects`/`Ensures`, `gsl::narrow_cast`. Use these types in interface signatures during design — the signature then documents the contract.

**Design-stage output:** the chosen ISO C++ standard, profiles, compiler/standard-library, and the analyzer configuration. Without these fixed, "which C++ is this?" becomes a review argument on every change.

---

## Questions to answer before designing

| Question | What it decides |
| --- | --- |
| What is the ownership model per type — value, unique, shared, or borrowed? | Every signature in the design; who frees what |
| Where are invariants established and enforced? | Constructors, factory functions, narrow wrappers, `Expects` |
| How does failure propagate — exceptions, `std::expected`/`error_code`, or terminate? | `noexcept` policy, boundary conversion, error taxonomy |
| What is the concurrency model — shared-nothing tasks, shared data + locks, or actors? | Mutex placement, message passing, atomics, thread lifetime |
| Is the ABI part of the contract (plugins, shared library, stable SDK)? | Pimpl, `inline`/header-only choices, symbol visibility, standard-library types in interfaces |
| Which parts are allocation-sensitive or on a hot path? | Container choice, `reserve`, `span`, compile-time computation |
| What is the value/reference boundary for expensive types? | Parameters, returns, move semantics, slicing hazards |
| How is this verified — unit tests, fuzzing, sanitizers, type-level `static_assert`? | Test layout and the evidence you will show |

**Output:** a short table per module — type | ownership | invariant | failure mode | thread-safety guarantee. If two subsystems disagree on ownership or error style, the design is not done.

---

## Baseline: express intent, be statically type-safe

- **P.1** express ideas directly in code: name the concept, don't comment it. **P.4** prefer a program that is statically type-safe; **P.5** catch problems at compile time; **P.8** don't leak resources; **P.10** prefer immutable data to mutable.
- **Represent concepts as types, not conventions.** A strong type (`struct UserId { std::uint64_t value; };`) makes argument transposition a compile error. **ES.45** no magic constants; **Enum.3** prefer `enum class`; **I.4** make interfaces precisely and strongly typed (no `int` where a `Meters` is meant, no `bool` parameters whose meaning is positional).
- **Invariants live in a type's constructor.** **C.41** a constructor should create a fully initialized object; **C.42**/`E.5` if it cannot, throw (or return a factory failure) instead of producing a half-built object; **C.2** use `class` if there is an invariant, `struct` otherwise; **C.4** a function is a member only if it needs direct access to the representation.
- **Initialization and immutability by default:** **ES.20** always initialize an object; **ES.22** don't declare a variable until you have a value for it; **ES.23** prefer `{}` initialization; **ES.25** declare `const`/`constexpr` unless it changes; **C.48** use default member initializers for constants; **C.49** prefer initialization to assignment in constructors.
- **Take the type system seriously in numbers:** **ES.100/ES.102/ES.106/ES.107** treat signed/unsigned mixing as a design smell — use signed types for arithmetic and `gsl::index`/`std::ptrdiff_t` for subscripts; **ES.46** no lossy narrowing; **ES.48/ES.49/ES.50** no C-style casts, no casting away `const`.

```cpp
// BAD: no invariant, uninitialized, unit-less ints, boolean soup
struct Session { int user; int ttl; bool secure; };
Session make(int u, int t, bool s);

// GOOD: strong types, invariant in the constructor, {}-init at call sites
class Session {
public:
    Session(UserId user, std::chrono::seconds ttl) : user_{user}, ttl_{ttl} {
        Expects(ttl > 0s);
    }
private:
    UserId user_;
    std::chrono::seconds ttl_;
};
```

---

## Ownership and lifetime model

This is where C++ designs fail. Decide ownership **per type**, in the public signature, before implementation.

| Intent | Type in the signature | Rules |
| --- | --- | --- |
| Value semantics, cheap or cheap-to-move | `T` (by value, in and out) | **F.16**, **F.20**, **C.41** |
| Exclusive ownership held by the function | `std::unique_ptr<T>` | **R.20**, **R.21**, **F.26** |
| Ownership transferred in | `std::unique_ptr<T>` by value | **R.32**, **F.26** |
| Exclusive pointer may be reseated | `std::unique_ptr<T>&` | **R.33** |
| Shared ownership genuinely shared | `std::shared_ptr<T>` | **R.20**, **R.21**, **F.27**, **R.34** |
| Shared, no retention | `const std::shared_ptr<T>&` | **R.36** |
| Borrowed, never null | `T&` | **F.16**, **F.60** |
| Borrowed, may be absent | `T*` (or `std::optional<std::reference_wrapper<T>>`) | **F.60**, **I.12**/`gsl::not_null` when non-null |
| Element sequence | `std::span<T>` / `gsl::span<T>` | **F.24**, **I.13** |
| C string | `const char*` / `gsl::zstring` | **F.25** |
| Break a cycle | `std::weak_ptr<T>` | **R.24** |

Non-negotiables:

- **RAII or nothing.** **R.1** manage resources automatically; **R.5** prefer scoped objects; **R.10** avoid `malloc`/`free`; **R.11** avoid explicit `new`/`delete`; **R.12** hand the result of an allocation straight to a manager; **ES.60** no `new`/`delete` outside resource-management code.
- **Never transfer ownership through a raw pointer or reference.** **I.11**; **R.3** a raw pointer must not own. `gsl::owner<T>` marks a legacy exception that must be justified in the plan.
- **Don't take smart pointers as parameters unless you mean lifetime.** **F.7**/**R.30**: a function that only reads a `Widget` takes `Widget&`, not `const shared_ptr<Widget>&` — otherwise it is unusable from stack objects and drags a refcount cost into the call.
- **No pointer into a `shared_ptr`'s object.** **R.37** don't pass a pointer obtained from `get()` where ownership may die; take the `shared_ptr` or copy the value.
- **Nothing dangles.** **F.43** never return a pointer or reference to a local; **F.42** return `T*` only to indicate a position; **F.44** return `T&` only when "no object" is not an option; **F.45** don't return `T&&`.
- **Views have lifetimes.** A `std::string_view`/`std::span` member or return is a design decision about who outlives whom. If the owner can move or free, store the sequence or make it explicit that the view is valid only within the call.
- **Lambdas capture what the design says.** **F.52** capture by reference for locally-used lambdas; **F.53** never capture by reference in a lambda that outlives the scope (stored, returned, or run on another thread); **F.54** never use `[=]` in a member function that touches members — write `[this]` or capture explicitly.

```cpp
// BAD: returns a view into a temporary; caller sees garbage
std::string_view name() const { return first_ + " " + last_; }

// GOOD: return the owning value, or a view whose owner is guaranteed
std::string name() const { return first_ + " " + last_; }
```

---

## Special members: the rule of zero and five

- **C.20** if you can avoid defining any special member, do (the rule of zero). Members that manage themselves (`std::string`, `std::vector`, `std::unique_ptr`) give you correct copy/move/destruction for free; hand-written ones are the main source of double-free and leak bugs.
- **C.21** if you define or `=delete` any copy, move, or destructor, define or `=delete` them all. Half-declared special members silently disable moves and quietly copy where you meant to move.
- **C.22** keep default operations consistent: copy means copy, move means move and leaves a valid state (**C.64**), assignment is self-assignment safe (**C.62**, **C.65**).
- **C.66**/**E.16** move operations, destructors, `swap`, and deallocation must not throw. **C.37** mark destructors `noexcept`; **C.36** a destructor must not fail.
- **C.60**/**C.63** copy/move assignment: non-`virtual`, take by reference, return `T&` (**F.47**).
- **C.80**/**C.81** be explicit with `=default` / `=delete` rather than writing an equivalent body or hiding intent.
- **C.67** a polymorphic (base) class should suppress public copy and move — slicing a derived through a value copy destroys the derived part. Hand out `unique_ptr<Base>` and use a virtual `clone` (**C.130**) when deep copy is genuinely needed.
- **C.35** a base class destructor is either `public` and `virtual`, or `protected` and non-`virtual`. Anything else is a leak or UB waiting for `delete base_ptr`.
- **C.82** never call virtual functions from constructors or destructors; during construction the dynamic type is the base, and the call silently resolves there.

```cpp
// BAD: public non-virtual dtor in a polymorphic base; copy slicing elsewhere
struct Shape { ~Shape() = default; virtual double area() const = 0; };

// GOOD: interface base, no data, virtual dtor, copies suppressed
class Shape {
public:
    virtual ~Shape() = default;
    Shape(const Shape&) = delete;
    Shape& operator=(const Shape&) = delete;
    virtual double area() const noexcept = 0;
};
```

---

## Parameter and return design

- **F.15** prefer the conventional pattern over clever forwarding; document any advanced technique in a comment.
- **F.16** "in" parameters: pass cheap-to-copy types (≤ 2–3 words) by value, everything else by `const&`. **F.17** "in-out" takes `T&`. **F.18** "will-move-from" takes `T&&` and moves. **F.19** forwarding references only in generic code that truly forwards.
- **F.20** prefer return values over output parameters; **F.21** return a `struct` (not a `tuple` of ambiguous fields) for multiple results.
- **I.23** keep the argument count low; a 7-parameter function is a design signal that a request/options struct is missing. **I.24** avoid adjacent parameters of the same type that could be transposed.
- **F.22**/**F.23** `T*` designates one object, `gsl::not_null<T*>` documents "cannot be null"; **F.24** a span designates a sequence; **I.13** never pass an array as a bare pointer plus a size.
- **F.48** don't `return std::move(local)`; **ES.56** write `std::move` only when an explicit move to another scope is needed.
- **C.46** single-argument constructors are `explicit` by default (unintended implicit conversions are a recurring source of surprises); **F.51** prefer default arguments over overload sets for equivalent alternatives; **F.55** no `va_arg`.
- **F.8** prefer pure functions; **F.2**/**F.3** one logical operation per function; a function that does I/O *and* computes *and* formats is three functions.

---

## Error handling strategy

Decide once, at design time (**E.1**), and apply it consistently. Mixed conventions are worse than either convention.

### Choose the mechanism by boundary

| Situation | Mechanism |
| --- | --- |
| Internal code, exceptional conditions, invariants broken | **Exceptions** (**E.2**, **E.3**) |
| Expected, frequent failure on a hot/embedded path, or `-fno-exceptions` | `std::expected<T, E>` (C++23) / `error_code` / status type; convert to exceptions at the boundary |
| Documented precondition violation | `Expects()` / assert in debug; `std::terminate` in release if continuing is meaningless |
| Cleanup on scope exit | **E.19** `gsl::finally` or a dedicated RAII handle, not `try`/`catch` |

### Rules that hold either way

- **E.4** design error handling together with the interface: what can fail, what is guaranteed afterwards, who converts the error.
- **E.5**/**C.42** a constructor that cannot establish the invariant fails loudly; prefer a factory returning `expected` for recoverable construction.
- **E.12**/**F.6** declare `noexcept` when exiting by exception is impossible or unacceptable — notably moves, `swap`, destructors, and default constructors (**C.44**).
- **E.13** never throw while directly owning a resource acquired in the same scope; wrap it in RAII first.
- **E.14** throw purpose-designed types (a hierarchy or a documented error enum), never `int`, `const char*`, or `std::string`; **E.15** throw by value, catch by `const&` (and not by value — that slices).
- **E.17**/**E.18** don't catch in every function; catch where you can actually handle or translate, and let everything else unwind.
- **C.35**/**E.16** destructors, `swap`, and deallocation never fail: no throw, no log-and-throw, no `std::terminate` fanfare. If cleanup can fail, provide an explicit `close()` that reports and make the destructor the leak-safe fallback.
- **E.7**/**E.8** state preconditions and postconditions in the header; they are the contract reviewers check.

```cpp
// BAD: failure reported three ways in one layer
Widget* make_widget(int kind);   // returns nullptr? throws? sets errno?

// GOOD: one mechanism per boundary, explicit contract
std::unique_ptr<Widget> make_widget(Kind kind);                    // throws on invalid input
std::expected<std::unique_ptr<Widget>, Error> try_make_widget(Kind kind);  // checked path
```

---

## Class and hierarchy design

- **C.1**/**C.2**/**C.3** organize related data into `struct`s; use `class` with an invariant; a concept with behavior and invariants deserves a type. **C.9** minimize exposure of members; **C.133** no `protected` data; **C.134** all non-`const` data members share one access level.
- **C.4**/**C.5** member function only when it needs the representation; helpers live in the class's namespace. **C.131** avoid trivial getters/setters — if the member has no invariant, make the type a `struct`.
- **C.7** don't define a type and declare a variable of it in the same statement. **C.8** `class` when any member is non-public.
- **Concrete before polymorphic.** Reach for a hierarchy only when the domain is genuinely hierarchical (**C.120**); most "extensible" designs become an `enum class` + `std::variant` + `std::visit`, which keeps operations local and avoids heap indirection and vtable churn.
- **Interfaces:** **C.121** a base class used as an interface is pure abstract (no data, public pure virtuals, empty virtual destructor); **C.122** separate interface from implementation when ABI or compile-time decoupling matters; **I.25** prefer an empty abstract class as an interface to a hierarchy with state; **C.126** an abstract class usually needs no user-written constructor.
- **Virtual discipline:** **C.128** specify exactly one of `virtual`/`override`/`final`; **C.132** don't make a function `virtual` without a reason (it is a customization point and an ABI commitment); **C.129** distinguish interface inheritance from implementation inheritance, and say which one you are doing.
- **Swap and equality:** **C.83** value-like types provide a `noexcept` `swap`; **C.86**/**C.87** make `==` symmetric and don't compare base subobjects; **C.89** keep hashing consistent with `==`.

---

## Function and interface design

- **I.1** make interfaces explicit (a named function or type, not an implicit convention). **I.2** avoid non-`const` globals; **I.3** avoid singletons — pass the dependency, inject it in tests. **I.22** avoid complex initialization of global objects (static initialization order fiasco).
- **I.4** precisely and strongly typed: units, ranges, and semantics in the type. **I.6**/**I.7** `Expects`/`Ensures` or comments for pre/postconditions; **I.9** document template parameters with concepts.
- **I.10**/**E.2** throw to signal failure to perform the required task; don't return a special value that callers will forget to check.
- **I.11**/**I.12**/**I.13** ownership and nullability are expressed in types, not in comments.
- **I.23**/**I.24** limit arguments and avoid transposable neighbors.
- **F.1**/**F.2**/**F.3** package operations as named functions, one logical operation each, short enough to read on one screen.
- **F.4** `constexpr` when a function could plausibly be evaluated at compile time; **Per.11** move computation from run time to compile time when it is genuinely constant.

---

## Concurrency design

- **CP.1** assume your code will run in a multithreaded program; **CP.2** avoid data races (any unsynchronized concurrent access with a writer is UB); **CP.3** minimize explicitly shared writable data — the design that shares least needs the least locking.
- **CP.4** think in tasks, not threads. Prefer `std::async`/`std::future`, a thread pool, or message passing over hand-managed `std::thread` graphs.
- **CP.20** RAII for locks, never bare `lock()`/`unlock()`; **CP.21** `std::scoped_lock` for multiple mutexes (deadlock-free by construction); **CP.44** always name the `lock_guard`/`unique_lock` (an unnamed temporary unlocks immediately).
- **CP.22** never call unknown code (virtual functions, callbacks, user hooks) while holding a lock. **CP.43** keep critical sections short; do I/O and allocation outside them.
- **CP.50** define a mutex together with the data it guards (one struct, one lock); a free-standing mutex "guarding" scattered fields has no enforceable relationship to them.
- **CP.25**/**CP.26** prefer `std::jthread` (or `gsl::joining_thread`) and don't `detach()`; a detached thread has no lifetime contract. **CP.23**/**CP.24** a joining thread may use pointers to enclosing-scope objects; a detached thread may only use statics and free-store objects.
- **CP.31** pass small data between threads by value rather than sharing; **CP.32** use `shared_ptr` for ownership shared across unrelated threads; **CP.8**/**CP.200** `volatile` is for non-C++ memory only — synchronization uses `std::atomic` or a mutex.
- **State the thread-safety guarantee per type**: "not thread-safe, callers synchronize" / "internally synchronized" / "immutable, safe to share by const reference". Unstated guarantees get assumed both ways in the same codebase.
- **CP.9** use the tooling: TSan in CI for anything with shared state; a design that only works because a test never runs two threads is not verified.

---

## Performance design

- **Per.1**/**Per.2**/**Per.3** don't optimize without a reason, prematurely, or something that runs rarely. **Per.6** no performance claims without measurements — state the benchmark, the input size, and the machine.
- **Per.7** design to enable optimization: contiguous data, value semantics, no gratuitous indirection, no per-element allocation. **Per.10** rely on the static type system — `void*` and byte-level tricks defeat the optimizer.
- **Per.11** move computation to compile time (`constexpr`, `consteval`, templates) where it is genuinely constant. **Per.19** access memory predictably (row-major traversal, cache-friendly layout); **Per.16**/**Per.18** compact structures and "space is time".
- **Per.14**/**Per.15** minimize allocations, and none on the critical path: preallocate (`reserve`), reuse buffers, consider a pool when the profile demands it. **ES.28** use a lambda for complex `const` initialization instead of an init-and-mutate sequence.
- **Measure before choosing an exotic container or allocator**; document the measured reason in the design so the next reader doesn't "simplify" it back.
- **Per.12**/**Per.13** eliminate redundant aliases and indirections — often a bigger win than micro-tuning arithmetic.

---

## Headers, modules, and ABI

- **One entity per header, self-contained and includable first.** A header that only compiles after another header is included is a design bug that spreads. Prefer forward declarations in headers, full includes in sources.
- **Inline is an ABI decision.** **F.5** `inline`/header-defined functions are part of the ABI and freeze in place; don't put an inline function into a stable interface unless it will not change.
- **Pimpl or an abstract interface for stable ABI.** If the library is consumed by binaries you don't rebuild (SDK, plugin, shared lib), hide implementation layout behind `struct Impl` + `std::unique_ptr<Impl>` or a pure-virtual interface (**C.122**); never expose STL layout in a stable ABI.
- **Symbol visibility and `noexcept` are part of the contract** — changing either breaks callers. Decide both now.
- **C++20 modules**: adopt only with an explicit migration plan; don't mix a module boundary into a header-based library without recording which units are modules.
- **Namespaces and naming:** `NL.5` don't encode type information in names (no Hungarian), `NL.10` prefer underscore-case consistently, `NL.16` interface first in a class. Consistency beats preference — the plan should name the convention once.

---

## Testing design

| Level | Scope | Mechanism |
| --- | --- | --- |
| Type-level | Invariants that should be impossible to violate | `static_assert`, concepts, `type_traits` checks (compile-fail tests) |
| Unit | Class invariants, ownership behavior, error paths | Test framework with ASan + UBSan enabled |
| Contract | Precondition enforcement in debug builds | Death tests / `EXPECT_DEATH` equivalents |
| Concurrency | No races, no deadlocks | TSan build plus a stress test with bounded iterations |
| Parser/decoder input | Memory safety on hostile input | libFuzzer/AFL harness in CI (bounds + lifetime profiles) |
| Integration | Library/platform boundaries | Real build of a consumer target, cross-compiler matrix |

- Test the invariants, not the implementation: constructing a value, exercising the operation, and checking the observable postcondition.
- **Sanitizer builds are the primary evidence** for lifetime and bounds claims; a green unit suite without ASan proves little about pointer-heavy code.
- For any type with a destructor or ownership, test: copy, move, move-from state, self-assignment, and destruction order.
- Failure paths (throwing constructors, `expected` error branches) need tests too — the "never happens" path is exactly where leaks live.

---

## Anti-pattern quick reference

| Anti-pattern | Consequence | Instead |
| --- | --- | --- |
| Raw owning pointer (`T*` that must be deleted) | Leaks, double free | `unique_ptr`/`shared_ptr` (**R.3**, **R.20**) |
| Hand-written destructor + copy ctor, no move | Rule-of-five breakage, silent copies | Rule of zero (**C.20**, **C.21**) |
| Public non-virtual destructor in a polymorphic base | UB on `delete base*` | Public virtual or protected non-virtual (**C.35**) |
| Copyable polymorphic base | Slicing | Suppress copy, virtual `clone` (**C.67**, **C.130**) |
| Passing `const shared_ptr<T>&` to read a `T` | Unusable from stack objects, refcount cost | `T&`/`T*` (**F.7**, **R.30**) |
| `unique_ptr<T>&` out-parameter to return a value | Unclear ownership, exception-unsafe | Return the `unique_ptr` (**F.20**) |
| Returning `string_view`/`span` of a temporary or member that can move | Dangling view | Return the owning type, or document the view's lifetime |
| `catch (std::exception e)` | Slicing, lost type info | `catch (const std::exception&)` (**E.15**) |
| `throw 42;` / `throw "error";` | Uncatchable by type, no payload | Purpose-designed exception types (**E.14**) |
| Throwing from a destructor | `std::terminate` | Report via `close()`, destructor as fallback (**C.36**, **E.16**) |
| `volatile` as synchronization | Data races, no ordering | `std::atomic` + memory order, or a mutex (**CP.8**) |
| Unnamed `lock_guard` temporary | No lock held at all | Name it (**CP.44**) |
| Callback invoked under a lock | Deadlock | Copy state out, unlock, then call (**CP.22**) |
| `[=]` capture in a member function | Captures `this` implicitly, dangles | Explicit `[this]`/member capture (**F.54**) |
| `new`/`delete` in business logic | Leaks on every new error path | Containers and RAII (**R.11**, **ES.60**) |
| Mixing signed/unsigned for sizes | Wrap-around bugs | `gsl::index`/`ptrdiff_t` (**ES.107**) |
| `reinterpret_cast`/C-style casts to "make it compile" | UB, aliasing violations | Fix the type design (**ES.48**, **ES.50**) |

---

## Design review checklist

Confirm each item during planning; only start implementing when all hold:

- [ ] ISO standard, compiler/stdlib, chosen profiles, and analyzer config are stated
- [ ] Every public type has a declared ownership model (value / unique / shared / borrowed) and it appears in the signature
- [ ] No ownership transfer via raw pointer or reference; no raw `new`/`delete` outside a resource manager
- [ ] Special members follow rule of zero, or all five are declared/`=default`/`=delete` together
- [ ] Destructors `noexcept`; polymorphic bases have a correct destructor and suppressed copying
- [ ] Invariants are established in constructors or factories, and stated as `Expects`/`Ensures` or documented pre/postconditions
- [ ] Error mechanism chosen per boundary (exceptions / `expected` / `error_code`), with a conversion point and a `noexcept` policy
- [ ] Exception types are purpose-designed; caught by `const&`; no catch-all swallowing
- [ ] Parameters use F.16/F.17 conventions; returns are values or structs, not output parameters; argument counts stay low
- [ ] Sequence parameters are spans (or documented pointer+size), not bare arrays; nullable pointers are `gsl::not_null` or explicit
- [ ] No returning views/pointers/references to locals or to members that can be invalidated
- [ ] Lambda captures match lambda lifetime (no by-reference capture outliving the scope, no `[=]` in members)
- [ ] Concurrency model stated per component: who owns threads, what is shared, what the thread-safety guarantee is
- [ ] Locks are RAII, mutexes live with their data, no unknown code called under a lock, no `detach()`
- [ ] Any performance claim cites a measurement; hot paths avoid per-element allocation and pointer chasing
- [ ] ABI decisions (inline, pimpl, visibility, symbols, `noexcept`) are recorded if the code crosses a binary boundary
- [ ] Verification plan covers sanitizers (ASan/UBSan/TSan), copy/move/self-assignment tests, and fuzzing where input is hostile
