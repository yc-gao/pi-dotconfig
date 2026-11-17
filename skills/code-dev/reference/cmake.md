# CMake Authoring Guide

Authoring conventions for **target-based ("modern") CMake** on **CMake 3.25+ / 4.x**. Read this during planning: it decides the target graph, what each target exports to its consumers, how dependencies are obtained, how the project is installed and exported, and how configuration is reproduced by other machines and CI.

> This is a **design** guide (read before editing `CMakeLists.txt`). For reviewing the C++ that a target compiles, use the [C++ Design Guide](cpp.md).
> The rule to remember throughout: **a `CMakeLists.txt` describes targets and their usage requirements — not a sequence of global switches.** Anything global (`include_directories`, `link_libraries`, `CMAKE_CXX_FLAGS`) leaks into every target added later and makes the build order-dependent.

## Contents

- [Questions to answer before writing CMake](#questions-to-answer-before-writing-cmake)
- [Baseline and project skeleton](#baseline-and-project-skeleton)
- [Targets are the design unit](#targets-are-the-design-unit)
- [Usage requirements: PRIVATE / PUBLIC / INTERFACE](#usage-requirements-private--public--interface)
- [Dependencies](#dependencies)
- [Compiler standard, warnings, sanitizers](#compiler-standard-warnings-sanitizers)
- [Configuration, build types, and code generation](#configuration-build-types-and-code-generation)
- [Presets and reproducible builds](#presets-and-reproducible-builds)
- [Testing](#testing)
- [Install, export, and packaging](#install-export-and-packaging)
- [Custom commands and generated files](#custom-commands-and-generated-files)
- [Toolchains and cross-compilation](#toolchains-and-cross-compilation)
- [Formatting and style](#formatting-and-style)
- [Anti-pattern quick reference](#anti-pattern-quick-reference)
- [Design review checklist](#design-review-checklist)

---

## Questions to answer before writing CMake

| Question | What it decides |
| --- | --- |
| What are the artifacts — executable, static lib, shared lib, header-only? | One `add_library`/`add_executable` per artifact, and their names |
| Who consumes them — nobody, the same build tree, or an external project after install? | Whether `install(TARGETS ... EXPORT ...)` + config files are required |
| What is the dependency policy — system packages, vendored, or fetched at configure time? | `find_package(CONFIG)` vs `FetchContent` vs vendored subdirectory |
| Which platforms, compilers, and architectures must build? | Generator expressions instead of `if(WIN32)` chains, toolchain files |
| What is the language standard, and is it per-target? | `target_compile_features`, never a global `CMAKE_CXX_STANDARD` |
| What are the build types — single-config only, or multi-config (VS/Xcode/Ninja Multi-Config)? | `$<CONFIG:...>` instead of `CMAKE_BUILD_TYPE` branches |
| Where do warnings, sanitizers, and `-Werror` live? | Opt-in interface targets / options, not `CMAKE_CXX_FLAGS` |
| How will tests run in CI and locally? | `include(CTest)`, test labels, `testPresets` |
| Is the build reproducible on a fresh machine? | Committed `CMakePresets.json` with pinned versions |

**Output:** a target table — target | type | sources | public include dirs | public deps | private deps | installed? — plus the presets that CI uses. If the table can't be filled in, the CMake design doesn't exist yet.

---

## Baseline and project skeleton

- **Declare a policy version range**, not a bare minimum: `cmake_minimum_required(VERSION 3.25...4.1)`. The range pins old behaviour for consumers on 3.25 and enables new policies on newer CMake. **CMake 4.0 removed compatibility with versions below 3.5**, so a bare `cmake_minimum_required(VERSION 3.10)` is a configuration error on modern installs.
- **Set the standard once, per target** (`target_compile_features(... cxx_std_20)`), not with `CMAKE_CXX_STANDARD`.
- **Out-of-source builds only**, driven by presets; the in-tree `build/` never gets committed.
- **`project()` named with a namespace prefix** so options and exported variables are unambiguous: `project(acme_net VERSION 2.3.1 LANGUAGES CXX)`.
- **Options are prefixed and defaulted off** for anything that changes what gets built:

```cmake
option(ACME_NET_BUILD_TESTS "Build acme_net tests" OFF)
option(ACME_NET_BUILD_EXAMPLES "Build acme_net examples" OFF)
option(ACME_NET_WERROR "Treat warnings as errors" OFF)   # ON in CI only
```

Skeleton:

```
CMakeLists.txt            # project(), options, add_subdirectory, nothing else heavy
CMakePresets.json         # committed; CMakeUserPresets.json is gitignored
cmake/
  AcmeNetConfig.cmake.in  # install/export template
  CompilerWarnings.cmake  # interface target with per-compiler warning flags
  Sanitizers.cmake        # interface targets: asan/ubsan/tsan
  modules/                # find modules, helper functions (each with include_guard)
src/
  core/CMakeLists.txt     # one directory per target group, targets declared next to sources
  core/include/acme/net/*.h
apps/cli/CMakeLists.txt
tests/CMakeLists.txt
```

- **Helper `.cmake` files start with `include_guard(GLOBAL)`** so double inclusion can't redefine functions.
- **Functions over macros** for reusable logic (`function()` gets its own scope); macros leak variables into the caller.
- Keep the top-level file about *composition*: `project()`, options, `add_subdirectory()`, install/export. Target details belong next to the sources they build.

---

## Targets are the design unit

One target = one logical artifact with one set of usage requirements.

- **Every library is a target with a name that says what it is**: `acme_net_core`, `acme_net_json`, `acme_net_cli`. No "misc" targets that grow into everything.
- **Namespace every target with `add_library(Acme::net_core ALIAS acme_net_core)`** — consumers link `Acme::net_core`, so the same spelling works in-tree and post-install.
- **Header-only code is an `INTERFACE` library**, not a list of includes exported by a parent target.
- **Sources are listed explicitly**: `target_sources(acme_net_core PRIVATE src/a.cpp src/b.cpp)`. `file(GLOB ...)` does not retrigger configure when files appear; `CONFIGURE_DEPENDS` works but is slow and fragile in large trees. Explicit lists also let review see which translation units belong to a target.
- **Public headers are a file set** (CMake 3.23+), which gives one list for building, IDE display, and install:

```cmake
add_library(acme_net_core)
add_library(Acme::net_core ALIAS acme_net_core)

target_sources(acme_net_core
  PRIVATE src/socket.cpp src/endpoint.cpp
  PUBLIC  FILE_SET HEADERS BASE_DIRS include FILES include/acme/net/socket.h
)

target_include_directories(acme_net_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>
)
```

- **Never add a target to the global graph from a subdirectory's perspective**: `add_subdirectory()` calls belong in the parent, with `EXCLUDE_FROM_ALL` for third-party trees so their tests/installs don't leak in.
- **Object libraries** are for sharing object files between exactly two artifacts; they are not a way to avoid declaring a proper target. Their usage requirements are not propagated the way a normal library's are.
- **Unity builds and precompiled headers are opt-in experiments** (`CMAKE_UNITY_BUILD`, `target_precompile_headers`): both can hide missing includes and ODR problems, so enable them behind an option and keep a non-unity CI job.

---

## Usage requirements: PRIVATE / PUBLIC / INTERFACE

This is where most build breakage originates. The question for every property is: *does a consumer of this target need it?*

| Property | Needs it to compile its own sources | Needs it to be passed to consumers |
| --- | --- | --- |
| Include dir | `PRIVATE` | `PUBLIC` (declared in public headers) |
| Link library | `PRIVATE` | `PUBLIC` |
| Compile definition | `PRIVATE` | `PUBLIC` (appears in a public header) |
| Compile feature/standard | `PRIVATE` (rare) | `PUBLIC` (default choice) |
| Compile option/warning | `PRIVATE` | almost never `PUBLIC` |
| Link option | `PRIVATE` | rarely (`INTERFACE` for a drop-in SDK) |

Rules:

- **`PRIVATE` is the safe default**; promote to `PUBLIC` only when a public header genuinely requires it (an `#include` of the dependency, or a macro in the header).
- **`INTERFACE` is for targets that contribute only requirements** — header-only libraries, compile-option bundles, sanitizer bundles.
- **Never link a dependency you don't expose as `PUBLIC` "just in case"**; that inflates every consumer's include path and link line and hides the real dependency graph.
- **Never use directory-scope commands** (`include_directories`, `link_libraries`, `link_directories`, `add_definitions`). They mutate state for everything added later, so the result depends on `add_subdirectory` order — the classic "works until someone reorders the file" bug.
- **Don't hardcode paths**: use `CMAKE_CURRENT_SOURCE_DIR`, `PROJECT_SOURCE_DIR`, and `GNUInstallDirs` variables; use `$<BUILD_INTERFACE:>`/`$<INSTALL_INTERFACE:>` so the same target works in-tree and installed.

---

## Dependencies

- **Prefer `find_package(<Pkg> CONFIG REQUIRED)`** so you consume an imported target with its real usage requirements. Guard obsolete search logic; do not write a new `FindFoo.cmake` unless nothing upstream exists.
- **Version-bound and explicit**: `find_package(fmt 10 CONFIG REQUIRED)`. Say whether the dependency is `REQUIRED`, `QUIET`, or optional-with-fallback, and always branch on the target existing (`if(TARGET fmt::fmt)`), not on a variable that may be stale.
- **Link targets, not raw library names.** `target_link_libraries(app PRIVATE fmt::fmt)`; `-lfoo`-style names bypass usage requirements and platform naming.
- **Fetching policy must be stated once** in the plan:
  - `FetchContent` with a **pinned `GIT_TAG` (a tag or commit SHA)** — never a moving branch.
  - `EXCLUDE_FROM_ALL` (3.28+) so the dependency's install/tests don't contaminate your tree; `SYSTEM` (3.25+) so its warnings don't fire.
  - `OVERRIDE_FIND_PACKAGE` on one declaration per package so `find_package` and `FetchContent` don't disagree.
  - An offline switch (`FETCHCONTENT_FULLY_DISCONNECTED` or a `ACME_NET_USE_SYSTEM_DEPS=ON` option) for CI and packagers.
- **Vendored sources**: `add_subdirectory(third_party/foo EXCLUDE_FROM_ALL SYSTEM)`, and never patch the vendored tree in place — record local patches as files that get applied, so the vendored version stays identifiable.
- **No dependency cycles**: if two libraries must link each other, the split is wrong — extract the shared part into a third target.
- **Don't `install()` or `export()` third-party targets** you fetch unless you deliberately re-export them; it makes your package impossible to relocate.

---

## Compiler standard, warnings, sanitizers

- **Standard**: `target_compile_features(acme_net_core PUBLIC cxx_std_20)`. Set it on the target that owns the interface; a global `CMAKE_CXX_STANDARD` silently re-standardizes dependencies too.
- **Warnings are a property of your own targets**, in an `INTERFACE` target so they stay in one place:

```cmake
add_library(acme_warnings INTERFACE)
target_compile_options(acme_warnings INTERFACE
  $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic;-Wconversion;-Wshadow>
  $<$<CXX_COMPILER_ID:MSVC>:/W4;/permissive->
)
target_link_libraries(acme_net_core PRIVATE acme_warnings)   # PRIVATE: never exported
```

- **Sanitizers follow the same shape**: an `INTERFACE` target per sanitizer, linked only into targets that opt in, only for the compilers that support it, and only when the option is on. Build types are not the switch — the option is:

```cmake
add_library(acme_asan INTERFACE)
target_compile_options(acme_asan INTERFACE -fsanitize=address,undefined -fno-omit-frame-pointer)
target_link_options(acme_asan INTERFACE -fsanitize=address,undefined)
```

- **`-Werror` is CI-only**: `if(ACME_NET_WERROR) ... endif()`. Turning every warning into an error in the default developer build means a compiler bump breaks everyone's local build for reasons unrelated to their change.
- **Never overwrite `CMAKE_CXX_FLAGS` / `CMAKE_CXX_FLAGS_<CONFIG>`** from a `CMakeLists.txt`; append-only usage options on targets, and leave the toolchain's own flags to the toolchain file.
- **Per-config flags use generator expressions**, not `if(CMAKE_BUILD_TYPE STREQUAL ...)`:

```cmake
target_compile_options(acme_net_core PRIVATE $<$<CONFIG:Debug>:-fno-inline>)
```

---

## Configuration, build types, and code generation

- **No `if(CMAKE_BUILD_TYPE)` logic in a project that may be built by a multi-config generator** (Visual Studio, Xcode, `Ninja Multi-Config`) — `CMAKE_BUILD_TYPE` is empty there. Use `$<CONFIG:Debug>` in options and `$<CONFIG>` in output paths.
- **Config headers** come from `configure_file(... @ONLY)` with a template (`config.h.in`) using `#cmakedefine01`; generate into `${CMAKE_CURRENT_BINARY_DIR}`, add that dir as `PRIVATE` include, and don't hand-write version numbers in two places.
- **Per-config generated content** (e.g. different asset lists) uses `file(GENERATE OUTPUT ... CONTENT ... $<CONFIG>)`, which is config-aware; `configure_file` is not.
- **Feature flags**: prefer `target_compile_definitions(target PRIVATE ACME_NET_TLS=1)` produced from options, and make the header consume `#cmakedefine01` rather than sprinkling `#ifdef` on build-system-specific names.
- **Detect capabilities, not platforms**, when possible: `check_cxx_source_compiles`, `CheckIncludeFileCXX`, `check_library_exists` — then express the result as a feature definition. A chain of `if(WIN32) / elseif(APPLE)` that duplicates for each compiler is a design smell.

---

## Presets and reproducible builds

Presets are the project's supported build interface: a fresh clone should build with `cmake --preset <name>` and nothing else.

```json
{
  "version": 6,
  "cmakeMinimumRequired": { "major": 3, "minor": 25, "patch": 0 },
  "configurePresets": [
    {
      "name": "base", "hidden": true,
      "generator": "Ninja Multi-Config",
      "binaryDir": "${sourceDir}/build/${presetName}",
      "cacheVariables": {
        "CMAKE_EXPORT_COMPILE_COMMANDS": "ON",
        "ACME_NET_BUILD_TESTS": "ON"
      }
    },
    { "name": "dev", "inherits": "base", "cacheVariables": { "CMAKE_DEFAULT_BUILD_TYPE": "Debug" } },
    { "name": "ci",  "inherits": "base",
      "cacheVariables": { "ACME_NET_WERROR": "ON", "ACME_NET_USE_SYSTEM_DEPS": "ON" } }
  ],
  "buildPresets": [ { "name": "dev", "configurePreset": "dev" } ],
  "testPresets":  [ { "name": "dev", "configurePreset": "dev", "output": { "outputOnFailure": true } } ]
}
```

Rules:

- **Commit `CMakePresets.json`; gitignore `CMakeUserPresets.json`.** Personal paths never enter the shared file.
- **`hidden` base presets** carry the shared generator and cache variables; visible presets differ only in what actually differs (build type, Werror, sanitizers, deps mode).
- **`binaryDir` includes `${presetName}`** so presets don't reuse each other's cache — the most common source of "clean build works, my build doesn't".
- **CI calls the same presets developers use** (`cmake --preset ci`, `ctest --preset ci`). Logic duplicated in YAML drifts from the presets within a month.
- **Pin `cmakeMinimumRequired`** in the presets file to the same version as `cmake_minimum_required`; a mismatch produces confusing early errors.
- **`CMAKE_EXPORT_COMPILE_COMMANDS`** stays on for clangd/clang-tidy; a project that can't produce it can't be statically analyzed by tooling.

---

## Testing

- **`include(CTest)`** at the top level (it defines `BUILD_TESTING`), then `if(BUILD_TESTING) add_subdirectory(tests) endif()`.
- **One `add_test(NAME ... COMMAND ...)` per behavior**, named `<target>.<area>.<case>` so `ctest -R` filtering is predictable. Set `WORKING_DIRECTORY` explicitly when the test reads files.
- **Register tests through the framework's discovery helper** (e.g. `gtest_discover_tests`, `catch_discover_tests`) so each test case is separately addressable and reported — not one mega-test that hides which case failed.
- **Labels for selectivity**: `set_tests_properties(x PROPERTIES LABELS "unit;integration;slow")`, then `ctest -L unit` in the fast feedback loop. Mark network/flaky tests and keep them out of the default preset.
- **Timeouts** (`TIMEOUT` property or `testPresets`) so CI can't hang on a dead test.
- **A sanitizer job and a Werror job exist as presets**, so "we run ASan in CI" is a file in the repo, not tribal knowledge.

---

## Install, export, and packaging

If anything outside the build tree consumes the project, the install/export surface is part of the design.

- **Use `GNUInstallDirs`** (`CMAKE_INSTALL_LIBDIR`, `INCLUDEDIR`, …) — never literal `lib`/`include`.
- **Install targets with an export set, the file set for headers, and a namespace**:

```cmake
include(GNUInstallDirs)
install(TARGETS acme_net_core EXPORT AcmeNetTargets
  FILE_SET HEADERS DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
  ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
  LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
install(EXPORT AcmeNetTargets
  FILE AcmeNetTargets.cmake
  NAMESPACE Acme::
  DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/AcmeNet
)
```

- **Generate the package config and version file** with `CMakePackageConfigHelpers` (`configure_package_config_file`, `write_basic_package_version_file`), and have `AcmeNetConfig.cmake` include the targets file plus `find_dependency()` for every `PUBLIC` dependency. Forgetting `find_dependency` is why downstream `find_package` fails with missing targets.
- **Only export targets whose usage requirements are complete.** A target whose `PUBLIC` include dir points into the source tree cannot be exported (`INTERFACE` generator expressions exist exactly to prevent this).
- **Test the install**: `DESTDIR`/`--prefix` install into a scratch prefix, then build a tiny consumer with `find_package(AcmeNet CONFIG REQUIRED)`. A package that was never consumed by an external project is untested.
- **Components** (`COMPONENT runtime/dev`) when packagers need runtime-only installs.
- **CPack only if you actually ship packages**; a half-configured `CPackConfig` is worse than none.

---

## Custom commands and generated files

- **`add_custom_command(OUTPUT ... DEPENDS ... COMMAND ... VERBATIM)`** with explicit inputs and outputs, and **`VERBATIM`** always. `COMMAND_EXPAND_LISTS` when a list must expand into separate arguments.
- **Model real dependencies**: a generated file's `DEPENDS` lists the generator script and every input. Missing dependencies produce stale-output bugs that only appear on incremental builds.
- **`add_custom_target` for phony targets** (docs, format, coverage) and make it depend on the real outputs; never use a custom target where a custom command output would let downstream targets depend on the file.
- **No `execute_process` for build-time logic** — it runs at configure time, once, with the wrong environment. Configure-time `execute_process` is acceptable only for querying a tool version, and the result belongs in a cache variable with a clear name.
- **Generated sources go under `${CMAKE_CURRENT_BINARY_DIR}`**, never back into the source tree.

---

## Toolchains and cross-compilation

- **One toolchain file per target platform**, passed via preset (`toolchainFile`) — compilers, sysroot, arch flags, and `CMAKE_SYSTEM_NAME` live there, not in `CMakeLists.txt`.
- **No `-march=native`, no host paths, no `if(CMAKE_HOST_SYSTEM_NAME)`** in project files; those break cross builds and binary distribution.
- **Check capabilities with `check_*` modules**, then gate the feature on the result, so a cross target without the capability degrades instead of failing.
- **`CMAKE_POSITION_INDEPENDENT_CODE` for shared-library consumers** is set on the target (`set_target_properties(... POSITION_INDEPENDENT_CODE ON)`), not globally.

---

## Formatting and style

- **Lowercase commands, one command per logical group, arguments one per line** when the line exceeds ~100 columns:

```cmake
target_link_libraries(acme_net_core
  PUBLIC  Acme::net_config
  PRIVATE acme_warnings Threads::Threads
)
```

- **Quote paths and any variable that can contain spaces** (`"${CMAKE_CURRENT_SOURCE_DIR}/include"`); unquoted paths are the most common source of Windows-only breakage.
- **Order the arguments consistently** across the codebase (`PUBLIC` before `PRIVATE`), so a diff shows what changed rather than reordering noise.
- **Comments explain *why*** — why a dependency is `PUBLIC`, why a flag is needed on this compiler, why a target is excluded from install. Not "add the library".
- **Use a formatter** (`cmake-format`/`gersemi`) configured in the repo, and run `cmake-lint` in CI; hand-formatting CMake across a team never stays consistent.
- **Don't reorder unrelated lines** in a `CMakeLists.txt` during a functional change; a reformat that touches 60 lines hides the 2-line fix.

---

## Anti-pattern quick reference

| Anti-pattern | Consequence | Instead |
| --- | --- | --- |
| `include_directories`, `link_libraries`, `link_directories`, `add_definitions` | Order-dependent builds; every later target inherits it | `target_*` with `PRIVATE`/`PUBLIC` |
| `set(CMAKE_CXX_FLAGS "...")` | Wipes toolchain/CI flags, applies to dependencies | `target_compile_options` |
| `if(CMAKE_BUILD_TYPE STREQUAL "Debug")` | Broken on multi-config generators | `$<CONFIG:Debug>` |
| `file(GLOB *.cpp)` for sources | New files don't trigger reconfigure; silent missing TU | Explicit `target_sources` list |
| Global `CMAKE_CXX_STANDARD` | Re-standardizes dependencies | `target_compile_features(... cxx_std_20)` |
| Linking `-lfoo` / raw paths | No usage requirements, non-portable | Imported targets / `find_package` |
| `find_package(Boost)` without `CONFIG`/version, then `include_directories(${Boost_INCLUDE_DIRS})` | Fragile, transitive flags lost | `Boost::boost` imported target |
| `FetchContent` with `GIT_TAG main` | Non-reproducible builds, surprise breakages | Pinned tag/SHA + `EXCLUDE_FROM_ALL` |
| Exporting a target whose include dir is a source path | Downstream `find_package` computes invalid paths | `$<BUILD_INTERFACE:>`/`$<INSTALL_INTERFACE:>` |
| Missing `find_dependency()` in the config file | Consumer fails with "target not found" | Add it for every `PUBLIC` dep |
| `PUBLIC` on a private dependency | Leaks headers/flags to all consumers | `PRIVATE` unless the public header needs it |
| `EXECUTABLE_OUTPUT_PATH`/`LIBRARY_OUTPUT_PATH` globals | Artifacts collide across presets/configs | `RUNTIME_OUTPUT_DIRECTORY` per target, or defaults |
| `-Werror` in the default build | Compiler bumps break every developer | Option, ON in CI only |
| Building/installing a fetched dependency's tests | Longer builds, broken installs | `EXCLUDE_FROM_ALL`, `SYSTEM` |
| Committing `build/` or `CMakeCache.txt` | Stale absolute paths, "works only on my machine" | Presets + gitignore |
| Logic duplicated in CI YAML instead of presets | CI and local builds diverge | `cmake --preset ci` in CI |

---

## Design review checklist

Confirm each item during planning; only start editing when all hold:

- [ ] Artifact list is explicit: every target named, typed, and owned by one directory
- [ ] Every target has an `ALIAS` with the project namespace; consumers link the alias
- [ ] `PRIVATE`/`PUBLIC`/`INTERFACE` chosen per property, with `PRIVATE` as the default
- [ ] No directory-scope commands (`include_directories`, `link_libraries`, `link_directories`, `add_definitions`)
- [ ] No global `CMAKE_CXX_FLAGS`, `CMAKE_CXX_STANDARD`, or `CMAKE_BUILD_TYPE` branching
- [ ] Sources listed explicitly (no `GLOB`); public headers declared as a `FILE_SET`
- [ ] Public include dirs use `$<BUILD_INTERFACE:>`/`$<INSTALL_INTERFACE:>`
- [ ] Dependencies consumed as imported targets with pinned versions; fetch policy stated (pinned `GIT_TAG`, `EXCLUDE_FROM_ALL`/`SYSTEM`, offline switch)
- [ ] Standard set with `target_compile_features`; warnings via an `INTERFACE` target linked `PRIVATE`
- [ ] Sanitizer and `-Werror` behaviour is an option + preset, not a hardcoded flag
- [ ] `cmake_minimum_required(VERSION x.y...z)` uses a range; CMake 4.x compatibility verified
- [ ] `CMakePresets.json` committed with hidden base presets, `${presetName}` binary dirs, and configure/build/test presets used by CI
- [ ] `include(CTest)` with per-case `add_test`, discovery helper, labels, and a timeout
- [ ] Install rules use `GNUInstallDirs`, an export set with a namespace, and generated config/version files; `find_dependency()` present for `PUBLIC` deps
- [ ] Install surface proven by building an external consumer against a scratch prefix
- [ ] Custom commands declare `OUTPUT`/`DEPENDS` and use `VERBATIM`; no configure-time `execute_process` for build logic
- [ ] Toolchain-specific flags live in a toolchain file selected by a preset; no host-specific assumptions
- [ ] Formatter/linter (`gersemi` or `cmake-format`, `cmake-lint`) configured and run in CI
