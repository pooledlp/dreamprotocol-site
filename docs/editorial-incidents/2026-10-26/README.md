# October 26, 2026 editorial hold

## Evidence and actual cause

- Repository: pooledlp/dreamprotocol-site.
- [Scheduled run 40400514593](https://github.com/pooledlp/dreamprotocol-site/actions/runs/40400514593), attempt 1, source commit `88cb89548f354f6b64ad19c256f8c12ece65678b`.
- [Diagnostic artifact 12688836290](https://github.com/pooledlp/dreamprotocol-site/actions/runs/40400514593/artifacts/12688836290), downloaded before its reported November 2, 2026 expiration. The original artifact contains only `draft.json` and `review.json`; both are preserved byte-for-byte here. There are no original research notes to inspect.
- Run record: `content/runs/2026-10-26.json`, held after three requests.
- Editorial code and workflow at the run commit match the pre-fix main versions inspected during this investigation.

The independent reviewer returned `approved: false` and three reasons: substantial overlap with the already-approved invoice-intake article, too much vendor-documentation summary, and insufficient new decision-driving value. The rejected title is “When to Automate Invoice or Intake-Form Extraction with Power Automate and AI Builder.” The comparison article is `content/generated/2026-09-28.json`, “How to automate invoice intake in Microsoft 365 without overbuilding it.”

Direct comparison supports the review: both cover emailed invoices, narrow input scope, extracting fields, converting string outputs, confidence-based exceptions, a bookkeeping/operations example, and human review. Renaming the question as when to automate did not produce a materially different decision. The lexical title-overlap validator did not catch this semantic overlap; the independent reviewer did, correctly withholding publication.

The recorded rejection is **originality/editorial value**, not a reported factual-accuracy, source-quality, formatting, API, or deployment failure. The code reached the independent review after local article validation. The website validation step for the new article was skipped; the separate existing-site build and deployment succeeded. This run does not demonstrate a site outage.

## Additional findings, distinct from the recorded rejection

1. The review searched broadly but explicitly opened only the overview page. The requirements page appeared in search results. The old `consultedSources` gate counted search hits and citation annotations as evidence of reading sources. The rejection prevented publication anyway; this is a latent verification weakness, not the recorded cause.
2. The draft uses literal `[0]` and `[1]` markers even though the renderer generates citation links from `sourceIndexes`. These would have appeared as redundant, unlinked markers.
3. The hypothetical workflow calls an email-triggered flow “instant.” [Microsoft's cloud-flow overview](https://learn.microsoft.com/power-automate/overview-cloud) distinguishes automated flows triggered by events such as email arrival from instant flows started with a button. The reviewer did not flag this. The historical draft is preserved unchanged as evidence and is not approved for reuse.
4. The draft discusses output strings, conversion, and the Process documents action while citing an overview/requirements pair, rather than the flow-specific page found during review. This warrants claim-by-claim source checking; general consistency with a vendor's documentation is not sufficient citation coverage.
5. The first-stage research output was not retained, and the persistent run record contained only a generic rejection message. The exact first-stage reasoning cannot be reconstructed from this artifact.

## Targeted corrections

- Supply existing takeaways, section headings, and checklists to every stage, for both prepared and generated articles.
- Ask research to compare three potential decisions, discard overlapping workflows, and prepare an explicit decision brief and claim-to-source map within the existing first request. This is prompt guidance; independent review remains the semantic novelty gate.
- Ask the writer to compare alternatives and conditions, keep factual claims within the two selected sources, and distinguish recommendations from vendor capabilities.
- Require explicit completed page-open actions in research and review; neither search hits nor annotations alone satisfy the gate. Review opens both cited pages first, leaving its third call for verification. An open action cannot itself prove a page was readable or a claim correct; independent review still judges that.
- Reject raw numeric citation markers and require renderer-managed references.
- Retain research diagnostics and bounded reviewer reasons in future persistent run records. The full feedback remains in the artifact.

No weekly reservation was deleted or changed. No article was published, approval forged, API retry added, or workflow rerun requested. The maximum remains three API requests and seven web-tool calls per reserved week. Existing reviewer rejection and website-validation gates remain in place. No workflow permission or schedule changes are needed.

## Validation and readiness

Local editorial regression tests cover explicit opens versus search-only evidence, missing/failed opens, preservation of the original rejection reasons, expanded topic context, citation markers, independent rejection, publication integration, and reservation idempotency. The full build/check/test commands are required before proposing the change. All tests use synthetic responses; no paid generation is triggered.

The proposed changes must reach `main` before they affect the next scheduled run, Monday November 2 at 16:17 UTC (08:17 Pacific, subject to GitHub scheduling delays). Passing tests does not guarantee model approval; the next live run remains subject to independent review. The October 26 article remains held.

## Evidence checksums (SHA-256)

- Original ZIP: `11bf10b8377d475e3f29f1e50c7c3a13d9cea0adf3c8d8071bd0d815de3eeacf`
- `draft.json`: `60542955aebbf19607e707ae0fbec4069d5616398eb297c3cc866698a947a2f6`
- `review.json`: `62d33dbab509e068f34def4a96e0d9df82fd68f13b2ea746857ead110054ee7f`

These diagnostic documents are repository evidence only. `scripts/package-site.mjs` excludes `docs/`, so they do not become website resources.
