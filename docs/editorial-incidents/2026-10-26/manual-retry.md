# Authorized manual retry

The owner explicitly requested a fresh article run after the editorial fixes were merged in PR #147. Preserve the original held outcome in original-run.json and the original diagnostic files in this directory. Remove only the held 2026-10-26 reservation to allow one manual retry, following the documented recovery procedure. Re-run the failed scheduled editorial job, whose checkout explicitly uses current main, so it runs the corrected implementation.

The normal reservation, three-request limit, independent review, validation, and publish-only-on-approval controls remain unchanged. Do not automatically retry again if this attempt is held.
