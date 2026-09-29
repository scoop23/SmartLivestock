# AGENTS.md — SmartLivestock

# DEVELOPMENT MODE — FEATURE FIRST

The primary goal in this repository is to **build and complete SmartLivestock features quickly**.

Do NOT perform a full codebase audit for every task.

Do NOT automatically run the full test suite.

Do NOT automatically create tests unless I explicitly ask for tests.

Do NOT spend large amounts of context analyzing unrelated files.

When I request a feature:

1. Understand the requested feature.
2. Inspect only the files directly related to that feature.
3. Check existing patterns so the implementation stays consistent.
4. Implement the feature.
5. Fix obvious errors caused by the implementation.
6. Briefly explain what was changed and how it works.
7. Stop.

## Testing Policy

By default:

- DO NOT run the entire backend test suite.
- DO NOT run the entire frontend test suite.
- DO NOT generate new unit tests.
- DO NOT generate integration tests.
- DO NOT generate end-to-end tests.
- DO NOT repeatedly run builds after every small edit.

Only run tests when:

- I explicitly ask you to test something.
- The feature is dangerous enough that verification is necessary.
- A small targeted check is needed to determine whether the code works.

Prefer lightweight verification.

For Django, prefer:

```bash
python manage.py check
```

instead of automatically running:

```bash
python manage.py test
```

For frontend work, prefer targeted TypeScript/lint checking when needed instead of repeatedly running a full production build.

Do not run:

```bash
npm run build
```

after every small frontend change unless it is necessary or I explicitly request it.

## Token / Context Efficiency

Minimize unnecessary exploration.

Do not read the entire repository for a small feature.

Example:

If I ask:

"Add livestock mortality submission"

inspect the relevant:

- mortality models
- serializers
- views
- URLs
- permissions
- frontend mortality pages/components
- API client/types

Do NOT inspect unrelated modules such as GIS, reports, AI, authentication internals, or census unless the requested feature depends on them.

Use existing architecture and patterns where reasonable instead of redesigning the application.

## Implementation Priority

For normal requests, prioritize:

1. Make the requested feature work.
2. Connect backend and frontend.
3. Add required validation.
4. Add required permissions.
5. Handle obvious errors/loading states.
6. Keep the implementation understandable.
7. Explain the important parts briefly.

Testing, broad refactoring, architecture audits, documentation cleanup, and optimization are secondary unless explicitly requested.

## Avoid Unrequested Work

Do NOT automatically:

- refactor unrelated code
- rewrite working components
- audit the entire project
- perform a full security audit
- inspect every model
- calculate project completion percentage
- update every documentation file
- add extensive tests
- optimize unrelated queries
- redesign architecture
- clean unrelated files

Stay focused on the task I gave you.

If you notice an unrelated problem, mention it briefly at the end instead of fixing it automatically.

## Feature Implementation Behavior

When I ask for a feature, assume I want you to implement it unless I specifically ask only for an explanation or plan.

Do not stop after giving me instructions.

Actually modify the necessary files.

Prefer completing a vertical slice:

```text
Database / Model
        ↓
Serializer / Backend Logic
        ↓
API Endpoint
        ↓
Permissions
        ↓
Frontend API Integration
        ↓
UI
```

Not every feature requires every layer.

Determine what is actually needed.

## Explanations

I still want to learn, but keep explanations concise unless I ask for a deep explanation.

After implementing something, explain:

### What changed
Brief summary.

### How it works
Explain the data flow.

### Important concept
Teach me the main Django / React / TypeScript concept involved.

### Files changed
List the important files.

Do not write a massive tutorial for every small modification.

## Tests Are Opt-In

Unless I specifically say:

- "test this"
- "write tests"
- "run the tests"
- "verify everything"
- "prepare this for production"

do not spend significant time or tokens creating or running tests.

Implementation is the default priority.

## Final Rule

**Build the requested feature first.**

Do not turn every feature request into a codebase audit.

Do not run expensive tests unless needed.

Do not investigate unrelated parts of SmartLivestock.

Make focused changes, explain them briefly, and stop when the requested feature is complete.


## Project Overview

SmartLivestock is a capstone information system for livestock monitoring, production records, surveillance, validation, reporting, and analytics.

The system is intended to support livestock-related workflows for the Municipal Agriculture Office and related personnel in Padre Garcia, Batangas.

Repository:

`SmartLivestock`

Local development path:

`F:\Dev\SmartLivestock`

The project uses a full-stack architecture consisting primarily of:

- Django
- Django REST Framework
- PostgreSQL / relational database
- Next.js
- React
- TypeScript
- REST APIs

The project may also contain planned or partially implemented features involving:

- livestock inventory
- farmer registration
- barangay records
- quarterly census
- production monitoring
- disease surveillance
- mortality records
- livestock inspection
- movement / clearance
- SIBAT / CBAT validation
- MAO approval
- dashboards
- reports
- GIS / mapping
- notifications
- AI-assisted analytics or reporting

Do not assume every planned feature is currently implemented.

Always verify against the source code.

---

# Primary Goal

When working in this repository, prioritize:

1. Correctness
2. Understandability
3. Capstone completeness
4. Security
5. Maintainability
6. Consistency
7. Testability
8. Simplicity

This is a college capstone project.

Do not unnecessarily turn the project into enterprise-scale architecture.

The final system should be something the developer can understand, explain, demonstrate, and defend during a capstone presentation.

---

# Developer Learning Requirement

The developer is still learning professional full-stack development.

Do not only modify code.

Whenever making a meaningful change, explain:

- what was wrong
- why it matters
- how the current code works
- what is being changed
- why the new approach is better
- what programming or software engineering concept is involved

Prefer explanations connected directly to SmartLivestock rather than abstract textbook explanations.

Do not hide complexity behind unnecessary abstractions.

Code should remain understandable to a student developer.

---

# Before Making Changes

Always inspect the repository first.

At minimum, check:

```bash
git status
git branch --show-current
git log --oneline -10
git remote -v
```

Before modifying an unfamiliar feature, inspect its complete path through the application.

For example:

Frontend page

→ frontend API function

→ HTTP request

→ Django URL

→ View / ViewSet

→ Serializer

→ Model

→ Database

Do not modify only one layer without checking whether other layers depend on it.

---

# Protect Existing Work

Never intentionally destroy uncommitted developer work.

Do not use destructive commands such as:

```bash
git reset --hard
git clean -fd
```

unless the developer explicitly requests them.

Do not:

- overwrite large sections of code unnecessarily
- remove files merely because they appear unused
- force-push
- rewrite Git history
- delete migrations without understanding their history
- replace the architecture wholesale
- expose secrets from `.env`
- print passwords, tokens, API keys, or secret keys

If potentially sensitive information is discovered, identify the location and type of secret without reproducing its value.

---

# Source of Truth

The source code is the primary source of truth.

Use documentation as supporting evidence, including:

- README.md
- project documentation
- database diagrams
- capstone requirements
- comments
- Git history

But do not assume documentation accurately reflects the current implementation.

When documentation and code disagree, report the discrepancy.

---

# Repository Inspection

Ignore generated or dependency directories when analyzing the project unless they are specifically relevant.

Common directories to ignore include:

```text
node_modules
.next
dist
build
coverage
__pycache__
.pytest_cache
.git
venv
.venv
env
```

Focus on source files and configuration.

---

# Backend Guidelines

The backend is primarily Django and Django REST Framework.

Before changing backend behavior, inspect:

- models
- migrations
- serializers
- views
- viewsets
- URLs
- permissions
- authentication
- services
- signals
- management commands
- tests

Prefer Django and DRF conventions unless there is a strong reason not to.

---

# Django Models

Models should represent actual SmartLivestock domain concepts clearly.

Important concepts may include:

- User
- Farmer
- Barangay
- Livestock
- Livestock Inventory
- Species
- Breed
- Census
- Census Item
- Production Record
- Disease Record
- Mortality Record
- Inspection
- Clearance
- Approval / Validation
- Notifications

Verify actual model names before making assumptions.

When reviewing models, check:

- ForeignKey relationships
- OneToOne relationships
- ManyToMany relationships
- nullable fields
- unique constraints
- database indexes
- cascading deletes
- timestamps
- auditability
- historical data preservation

Avoid duplicating the same source of truth across multiple tables unless necessary.

---

# Migrations

Treat migrations carefully.

Do not delete migrations merely because they look messy.

Before creating migrations:

```bash
python manage.py makemigrations --check --dry-run
```

When appropriate, run:

```bash
python manage.py showmigrations
```

If schema changes are necessary, create proper migrations.

Avoid manually editing historical migrations unless there is a specific and justified reason.

---

# Django REST Framework

Use DRF consistently.

Prefer clear separation between:

- Model
- Serializer
- View / ViewSet
- Permission
- URL / Router

Avoid placing large amounts of unrelated business logic directly inside views.

If logic becomes complex and is reused, consider extracting it into a service/helper.

Do not create abstractions simply for architectural appearance.

---

# Serializers

Serializers should:

- validate user input
- prevent unauthorized field modification
- expose appropriate fields
- provide predictable response structures
- avoid trusting sensitive fields from the frontend

Be especially careful with fields such as:

- user
- owner
- farmer
- role
- approval status
- created_by
- approved_by
- barangay
- permissions

Do not allow users to assign privileged relationships simply by sending IDs from the frontend.

Use authenticated server-side context where appropriate.

---

# Authentication vs Authorization

Always distinguish:

**Authentication**

Who is the user?

from:

**Authorization**

What is this user allowed to do?

A user being logged in does not automatically mean they can access every SmartLivestock record.

Always verify object ownership and role permissions.

---

# Roles and Permissions

SmartLivestock may contain roles such as:

- Farmer
- SIBAT
- CBAT
- MAO
- Agricultural Technologist
- Livestock Inspector
- Auction Personnel
- Slaughterhouse Personnel
- Administrator

Do not assume these exact roles exist.

Check the actual implementation.

Role rules must be enforced by the backend.

Frontend hiding is not security.

Example:

If a Farmer cannot see another Farmer's livestock records, enforce that rule in Django querysets / permissions.

Do not rely only on hiding buttons in React.

---

# Object-Level Security

Watch carefully for IDOR / horizontal privilege escalation.

Example danger:

```http
GET /api/livestock/123/
```

A logged-in Farmer should not automatically be allowed to access livestock record `123`.

Verify that the record belongs to that Farmer or that their role permits access.

Apply this principle to:

- livestock
- census
- production
- disease
- mortality
- farmer data
- inspections
- clearances
- reports

---

# Query Efficiency

Check Django queries for obvious inefficiencies.

Use when appropriate:

```python
select_related()
prefetch_related()
```

Especially inspect list endpoints that return relational data.

Avoid N+1 query patterns.

Do not optimize prematurely when the dataset or query is trivial.

---

# Transactions

Use database transactions when multiple related database operations must succeed or fail together.

For example:

Submitting a census

→ creating census items

→ changing submission status

→ recording approval history

may require atomic behavior depending on implementation.

Use:

```python
transaction.atomic()
```

when data consistency requires it.

---

# Frontend Guidelines

The frontend primarily uses:

- Next.js
- React
- TypeScript

Before changing a page, inspect:

- route
- layout
- page
- child components
- hooks
- API client
- TypeScript types
- authentication state
- React Query usage

Do not duplicate backend business rules unnecessarily in the frontend.

The backend remains authoritative.

---

# React Components

Prefer components with clear responsibilities.

Avoid extremely large components containing:

- API calls
- forms
- validation
- business logic
- modal logic
- tables
- formatting
- permissions

all in one file.

Break components apart when it makes the code easier to understand.

Do not fragment simple components unnecessarily.

---

# TypeScript

Avoid unnecessary:

```typescript
any
```

Use interfaces or types for important API responses and request payloads.

Frontend types should match the real backend API.

If backend and frontend disagree, fix the contract rather than hiding the mismatch with `any`.

---

# API Client

Prefer a consistent API access layer.

Avoid scattering raw URLs such as:

```typescript
fetch("http://localhost:8000/api/...")
```

throughout many components.

Use the project's existing API client / Axios / fetch abstraction if one exists.

Keep endpoint handling consistent.

---

# React Query

If React Query / TanStack Query is used, prefer it for server state.

Use it for:

- fetching
- caching
- refetching
- mutations
- invalidation
- loading states
- error states

Do not copy fetched server data into React state unless there is a real need.

After mutations, invalidate or update relevant queries.

---

# Forms

Forms should provide:

- clear labels
- validation
- useful errors
- disabled/loading states
- safe submission handling

Server-side validation is still required even when frontend validation exists.

Frontend validation improves UX.

Backend validation protects data integrity.

Both matter.

---

# Loading and Error States

Pages communicating with APIs should handle:

- loading
- empty results
- API errors
- unauthorized responses
- failed submissions

Do not leave users with blank pages when a request fails.

---

# SmartLivestock Core Workflow

When reviewing or modifying SmartLivestock, preserve the intended validation workflow.

A likely workflow is:

```text
Farmer / Encoder
      ↓
Submits information
      ↓
Pending validation
      ↓
SIBAT / CBAT review
      ↓
Forward / Return / Reject
      ↓
MAO review
      ↓
Approve / Return / Reject
      ↓
Official record
      ↓
Reports / Analytics
```

This is only a conceptual reference.

Verify the actual implementation before changing behavior.

Do not force this exact workflow if the current capstone requirements differ.

---

# Workflow Statuses

Avoid uncontrolled status strings scattered throughout the code.

Bad example:

```python
status = "approved"
status = "Approved"
status = "APPROVE"
```

Prefer centralized status choices/enums.

Examples may include:

```text
DRAFT
PENDING
FOR_VALIDATION
FOR_MAO_REVIEW
APPROVED
REJECTED
RETURNED
```

Use the actual workflow requirements.

Every status transition should have a clear meaning.

---

# Approval Logic

Approval should be auditable where appropriate.

Important actions may need to record:

- who submitted
- who reviewed
- who approved
- previous status
- new status
- timestamp
- remarks

Avoid overwriting important historical information when the system requires traceability.

This is especially important for government / municipal reporting workflows.

---

# Capstone Scope Priorities

When recommending work, classify it.

## P0 — Capstone Critical

Features required for the primary workflow to function.

Examples may include:

- authentication
- permissions
- farmer records
- livestock records
- census
- validation
- MAO approval
- reliable database persistence

## P1 — Important

Features that make the system complete and usable.

Examples:

- production
- disease
- mortality
- inspections
- reports

## P2 — Strong Enhancements

Examples:

- dashboards
- analytics
- GIS
- notifications

## P3 — Optional / Polish

Examples:

- animations
- advanced styling
- convenience improvements
- optional AI features

Do not prioritize visual polish while the core workflow is broken.

---

# AI Features

Do not label ordinary CRUD, filtering, dashboards, or statistical summaries as AI.

If the repository contains AI-related features, determine whether they actually use:

- machine learning
- LLMs
- NLP
- predictive models
- classification
- anomaly detection
- other genuine AI techniques

If AI is planned but not implemented, clearly describe it as planned.

Do not fabricate AI capability.

---

# GIS Features

If map/GIS functionality exists, verify:

- source of coordinates
- barangay mapping
- latitude / longitude storage
- privacy implications
- map library
- backend/frontend integration

Do not introduce precise household location collection without a clear project requirement.

---

# Reports

Reports should derive from reliable stored data.

Avoid hardcoded dashboard numbers.

If reports are intended for DA / municipal reporting, ensure:

- filters are correct
- totals are reproducible
- approved vs pending data is handled intentionally
- date periods are clear
- species/categories are consistent

---

# Data Integrity

Livestock data can be represented as individual animals or aggregate counts.

Do not mix these concepts accidentally.

Before changing livestock-related models, determine whether the system tracks:

1. individual animals,

2. aggregate livestock counts,

or

3. both.

Clearly understand how inventory, census, production, disease, and mortality relate.

---

# Code Quality

Look for:

- duplicated logic
- dead code
- unused imports
- unused files
- giant components
- giant views
- debug prints
- console.log
- TODO
- FIXME
- hardcoded URLs
- hardcoded user IDs
- hardcoded role IDs
- inconsistent naming
- duplicated TypeScript types
- repeated API logic
- commented-out old implementations

Do not remove code until its usage has been verified.

---

# Cleanup Philosophy

Prefer:

small refactors

over:

large rewrites.

Good cleanup should:

- reduce duplication
- clarify responsibilities
- simplify logic
- improve naming
- preserve behavior

Avoid changing dozens of unrelated files in one operation.

---

# Overengineering Rules

Do not add unnecessary architecture such as:

- microservices
- Kubernetes
- Kafka
- RabbitMQ
- CQRS
- event sourcing
- unnecessary Redis
- complex domain frameworks
- excessive repository layers
- unnecessary factories
- abstraction for abstraction's sake

unless there is a concrete project requirement.

SmartLivestock should favor straightforward full-stack architecture.

---

# Testing

Before declaring something fixed, verify it where possible.

Backend checks may include:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Use the project's actual environment and package manager.

Frontend checks may include:

```bash
npm run lint
npm run build
npm test
```

Inspect `package.json` before assuming commands exist.

Do not claim tests passed unless they were actually run.

---

# Build Failures

When a check fails, distinguish whether the cause is:

- application bug
- TypeScript error
- lint error
- migration issue
- dependency issue
- configuration issue
- missing environment variable
- unavailable service
- local environment issue

Do not automatically rewrite application code to compensate for a broken environment.

---

# Security Checklist

Always watch for:

- committed secrets
- hardcoded passwords
- insecure role assignment
- unrestricted endpoints
- missing authentication
- missing object ownership checks
- insecure CORS
- unsafe DEBUG configuration
- trusting frontend role values
- unrestricted serializers
- IDOR vulnerabilities
- unsafe file uploads
- SQL injection
- XSS
- CSRF issues
- sensitive data exposure

Backend authorization is mandatory.

---

# Environment Files

Never commit real `.env` values.

Prefer:

```text
.env
.env.local
```

for secrets and:

```text
.env.example
```

for documentation.

An example environment file must contain placeholders, not real credentials.

---

# Documentation

When architecture or setup changes significantly, update relevant documentation.

Documentation should explain what really exists.

Do not document planned features as completed features.

---

# Completion Percentage

If asked to estimate capstone completion, do not estimate based on file count.

Evaluate major modules based on:

- model/database
- backend logic
- API
- permissions
- frontend
- integration
- validation
- testing

Suggested interpretation:

```text
0%   = absent
25%  = skeleton / started
50%  = core implementation exists but incomplete
75%  = mostly functional
90%  = functional with minor gaps
100% = implemented, integrated, tested, and capstone-ready
```

Use weighted feature importance.

Core workflows should have more weight than optional visual polish.

Always show evidence supporting the score.

---

# Feature Classification

When auditing the project, classify features as:

```text
VERIFIED
IMPLEMENTED
PARTIAL
PLANNED
BROKEN
UNVERIFIED
```

Definitions:

### VERIFIED

Feature has been tested or otherwise strongly confirmed to work.

### IMPLEMENTED

Meaningful implementation exists but was not fully runtime-verified.

### PARTIAL

Some layers exist but important parts are missing.

### PLANNED

Documentation or placeholders exist but there is no meaningful implementation.

### BROKEN

Implementation exists but currently fails.

### UNVERIFIED

Insufficient evidence to determine behavior.

Do not treat IMPLEMENTED as VERIFIED.

---

# Explaining Changes

For meaningful changes, use this structure:

## Problem

Explain what is wrong.

## Why It Matters

Explain the consequence using SmartLivestock.

## Current Flow

Explain how the existing code works.

## Change

Explain what is being changed.

## New Flow

Explain how the code works after the change.

## What To Learn

Explain the programming/software engineering concept involved.

Keep explanations practical.

---

# Teaching Style

Prefer examples from this repository.

For Django, explain concepts such as:

- models
- migrations
- serializers
- viewsets
- permissions
- querysets
- transactions
- select_related
- prefetch_related

For frontend development, explain concepts such as:

- React state
- server state
- React Query
- hooks
- components
- TypeScript
- API contracts
- client/server components

Use simple wording without removing important technical details.

---

# When Fixing Bugs

Do not only patch the visible symptom.

Trace the cause.

Example:

If a page displays no livestock records:

Do not immediately modify the UI.

Check:

```text
database
→ queryset
→ permissions
→ serializer
→ API response
→ frontend API client
→ React Query
→ component rendering
```

Determine where the data disappears.

---

# When Adding Features

Before adding a feature:

1. Find the related existing domain.
2. Inspect models.
3. Inspect current APIs.
4. Inspect frontend patterns.
5. Reuse conventions when they are good.
6. Identify required permissions.
7. Identify validation.
8. Identify testing requirements.
9. Implement the smallest coherent solution.

Avoid creating a second architecture inside the same repository.

---

# Definition of Done

A feature should not automatically be considered done because a page exists.

A reasonably complete SmartLivestock feature usually needs:

```text
Database
+
Model
+
Migration
+
Serializer / validation
+
API
+
Permissions
+
Frontend
+
Loading/error handling
+
Integration
+
Testing or verification
```

Not every feature requires every layer, but evaluate the complete user workflow.

---

# Capstone Defense Mindset

When making architecture decisions, prefer designs that the developer can explain during defense.

The developer should be able to answer:

- Why does this table exist?
- Why is this a ForeignKey?
- Why is this permission checked?
- Why does this status exist?
- Why is this API necessary?
- Why is this component separated?
- Why is this data validated?
- What prevents one user from viewing another user's data?
- What happens when validation fails?
- What makes this more than CRUD?
- Which parts are genuinely AI?

Avoid solutions that work but cannot reasonably be explained.

---

# Capstone Value

The system should demonstrate more than basic create/read/update/delete pages.

Its strongest value should come from workflows such as:

```text
data collection
→ validation
→ approval
→ monitoring
→ reporting
→ analytics
```

Focus development on making these workflows reliable and demonstrable.

---

# Change Reporting

After making changes, summarize:

```text
Files changed:
- ...

Problem fixed:
- ...

Behavior before:
- ...

Behavior after:
- ...

Verification performed:
- ...

Remaining issues:
- ...

What the developer should learn:
- ...
```

Do not claim success without verification.

---

# Commit Philosophy

When commits are requested, prefer focused commits.

Examples:

```text
fix: restrict farmer livestock queryset by owner

fix: validate census status transitions

refactor: centralize livestock API types

feat: add MAO census approval workflow

test: cover farmer livestock permissions
```

Avoid combining unrelated fixes into one huge commit.

Do not commit unless explicitly requested.

---

# Final Rule

Before changing code, understand the feature.

Before deleting code, prove it is unused.

Before calling something complete, verify it.

Before introducing architecture, justify its value.

Before fixing a symptom, trace its cause.

Before calling something AI, confirm that it actually is AI.

And whenever meaningful code is changed:

**teach the developer what changed and why.**