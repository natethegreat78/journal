import { readFileSync } from "fs";

const t = process.env.GH_PUSH_TOKEN;
const h = { Authorization: `token ${t}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
const path = ".github/workflows/build-mac.yml";
const url = `https://api.github.com/repos/natethegreat78/journal/contents/${encodeURIComponent(path)}`;

// Get current file SHA
const cur = await fetch(url, { headers: h }).then(r => r.json());
if (!cur.sha) { console.error("Failed to get SHA:", JSON.stringify(cur)); process.exit(1); }
console.log("Current SHA:", cur.sha);

// Read local file
const content = readFileSync(path, "utf8");
console.log("File contains --no-frozen-lockfile?", content.includes("--no-frozen-lockfile"));

// Push update
const res = await fetch(url, {
  method: "PUT",
  headers: h,
  body: JSON.stringify({
    message: "fix: use --no-frozen-lockfile to bypass lockfile config mismatch",
    content: Buffer.from(content).toString("base64"),
    sha: cur.sha
  })
}).then(r => r.json());

if (res.content?.sha) {
  console.log("Updated! New SHA:", res.content.sha);
} else {
  console.error("Update failed:", JSON.stringify(res));
  process.exit(1);
}

// Trigger workflow_dispatch
const trigger = await fetch(
  "https://api.github.com/repos/natethegreat78/journal/actions/workflows/build-mac.yml/dispatches",
  { method: "POST", headers: h, body: JSON.stringify({ ref: "main" }) }
);
console.log("Trigger status:", trigger.status);
