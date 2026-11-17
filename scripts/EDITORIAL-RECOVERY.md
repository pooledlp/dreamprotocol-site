# Editorial API recovery

Production requests now use at most three HTTP attempts per logical request,
with exponential jitter and Retry-After handling. Quota/billing failures stop
immediately. Authentication/configuration errors and ambiguous transport failures
are not retried. Safe diagnostics retain status, code/type, request ID and attempt
count, never raw response bodies, credentials or request content.

The research/write/review ceiling remains three logical calls. Publication still
requires source retrieval, independent approval and complete website validation.
Recovery never overwrites a generated article. Existing two-call saved-draft
review continuation remains supported with the existing checksum and path checks.

For a held first-request HTTP 429, an explicitly selected manual-dispatch input
`recover_failed_editorial` allows one recovery in the same UTC week. Default is
false. The prior run/call/reason remain in the record. Repeated recovery, later-stage
failure, transport ambiguity or existing articles block regeneration. Do not delete
run records to bypass these guards. The reservation date is propagated so a run
crossing midnight does not switch records.

This week's legacy failure lacks the API error code and request ID. Check the API
project's credits/limits before authorizing paid generation; these fixes cannot
resolve exhausted credits. No live API probe is part of validation. A normal push
runs website validation/deployment but not editorial generation.

Validation: npm test, npm run build, npm run check, git diff --check. HTTP tests
use mocked responses and do not need credentials.
