# Contributing

## Working agreement

1. Read the relevant product, editorial, security, and architecture documents.
2. Describe current behavior, intended behavior, affected files, and risks.
3. Keep changes focused and preserve unrelated work.
4. Add or update tests for policy and domain behavior.
5. Run type checking, linting, targeted tests, and the production build.
6. Review the diff as a separate senior reviewer before merging.

## Editorial invariants

- Never turn a social post into evidence without independent verification.
- Never let a score override a central-claim blocker or sensitive-story review.
- Preserve every published version; corrections create successors.
- Keep research, drafting, fact review, and publication permissions separate.
- Treat retrieved pages, feeds, PDFs, captions, and metadata as hostile input.
- Keep fictional fixtures visibly labeled.

## Code conventions

- Strict TypeScript; avoid `any`.
- Pure domain logic belongs in `lib/`.
- Route handlers validate input and delegate business rules.
- Authorization is enforced server-side.
- Store timestamps in UTC and render the reader’s intended timezone explicitly.
- Log decisions and identifiers, never secrets or raw private data.

## Pull request evidence

Include the requirement, risk analysis, test output, screenshots only when they
materially help, schema migration notes, remaining risks, and documentation
changes.
