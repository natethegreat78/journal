---
name: Dependency remediation
description: Verify transitive dependency fixes against the audit, not update command success
---

Do not assume a successful recursive pnpm update or dedupe refreshed every vulnerable transitive dependency.

**Why:** Both commands have left vulnerable locked versions in place, including dependencies whose parent releases still pin old versions.

**How to apply:** Upgrade the direct parent first, then audit the resolved lockfile. If the latest parent still resolves an affected release, use a narrowly scoped patched-version override and verify both the audit and the consuming build.
