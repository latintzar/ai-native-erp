# 0011 · Establish intent and implementation separately
**Date:** 2026-09-07 · **Status:** accepted

## Context

The shipped runtime, shared prototype and designed replacement can implement different behaviour
under the same name. Inferring readiness from an address led an agent toward the existing backend
when Peter meant the improved prototype. Shared administrator credentials also made a written
human-release rule weaker than the intended authority boundary.

## Decision

Before a substantive change, compare the applicable directive/spec, prototype and implementation.
Resolve the target from evidence; ask Peter when a meaningful version choice remains. Hosting
describes an environment; integration and release evidence establish readiness. The shared kit is
maintained product source, and accepted prototype changes go through ordinary PR gates.

Keep stable rules in AGENTS, source relationships in the product map, intended behaviour in the
subject specs, and current work in issues. Use ordinary Git, Make and GitHub; skills are optional.
Existing directory roles are checked in CI. Separate task worktrees keep concurrent work isolated.

Main protection includes administrators. Production tag publication has one executor, CI. The Team
plan uses a restricted tag and a separate human release principal, not a required environment
reviewer. Hold tagged publication until machine/human credential separation is commissioned.
The current tag publisher releases the kit app prototype; the future product release needs its
own rehearsal. This supersedes the address-as-readiness assumption in 0008 and the local publishing
path in 0007, preserving their histories.

## Consequences

Agents inspect competing versions before making changes, while Peter decides only unresolved
product choices. Future hires have one discoverable workflow. CI can reject structural mistakes;
review remains responsible for intent. Shared credentials must be replaced before tagged publishing
resumes. Product wiring, DNS moves and deleting predecessors are separate tasks.

## Source

Peter's [FEED-IA §210](../FEED-IA.md#210), especially the instruction to check for an improved prototype
and ask, and his clarification that wiring is a later task. [Engineering workflow](../ENGINEERING.md),
[readiness evidence](../ENGINEERING-READINESS.md), [GitHub flow decision](0007-main-is-protected.md)
and [environment decision](0008-environments.md).
