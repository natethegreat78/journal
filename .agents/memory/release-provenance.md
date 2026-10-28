---
name: Release provenance
description: Preserve release source identity when repairing CI and publishing installers
---

Keep version tags unchanged when correcting a CI-only failure. A retry should use the corrected pipeline but check out the original version tag, not whichever application code is now on the default branch.

**Why:** Otherwise, an installer can contain code that does not match its release tag. A failed upload does not justify silently changing the tagged application source.

**How to apply:** Separate the workflow revision from the application source revision when retrying a release, and verify that the checked-out package version matches the release tag.

Use GitHub Actions' per-run token with explicit contents-write permission for uploads to the same repository rather than relying on a saved personal access token.

**Why:** A saved token can expire and block publishing even after the native build succeeds.

**How to apply:** Keep release-upload authorization inside the workflow's scoped permissions; do not introduce a long-lived token dependency for same-repository releases.

Mac releases must provide both Intel and Apple Silicon downloads.

**Why:** The user explicitly requires an Intel Mac version alongside Apple Silicon.

**How to apply:** Preserve both architectures when updating releases and the download page. Build and check native dependencies on matching runners rather than assuming an Apple Silicon installer works on Intel.
