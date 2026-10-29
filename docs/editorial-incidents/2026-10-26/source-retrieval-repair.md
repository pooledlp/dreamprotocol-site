# Source retrieval repair after live retry

The first manual retry (run 40400514593, attempt 2) stopped after one API request: the model opened one source despite instructions to open two. The exact held run record is archived as retry-2-run.json. The owner then requested a fix and publication.

The application now downloads the two discovered pages itself before writing and independently downloads both again before review. This replaces reliance on model-selected open_page actions; it does not waive source evidence or independent editorial approval. Failed downloads and unsupported content still hold publication. No additional AI calls or automatic retries are added. The original request, web-tool, weekly reservation, and publication controls remain.

The research response now selects exactly two sources in structured JSON. Evidence downloads validate URL domains on every redirect, bound body size/time, strip markup, and require readable text. Evidence metadata records hashes and truncation. The writer receives source text, and the reviewer receives fresh text rather than relying on the writer's claims. Original recommendations are distinguished from vendor features.

Tests also isolate the generated-content directory in the held-run CLI fixture, so an already-generated current-week article cannot make a rejection test falsely fail. Approved JSON is retained in diagnostics for recovery from unrelated site validation failures without regenerating an article.

The archived held reservation is reset once for a live verification run under the owner's instruction to fix the process and get articles published. Future scheduled weeks still permit one automatic attempt. No publication approval is synthesized.
