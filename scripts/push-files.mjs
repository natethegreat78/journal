import { readFileSync } from "fs";

const t = process.env.GH_PUSH_TOKEN;
const h = { Authorization: `token ${t}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
const base = "https://api.github.com/repos/natethegreat78/journal/contents";

async function pushFile(path, localPath, message) {
  const url = `${base}/${path}`;
  const cur = await fetch(url, { headers: h }).then(r => r.json());
  if (!cur.sha) { console.error(`Failed to get SHA for ${path}:`, JSON.stringify(cur)); process.exit(1); }
  const content = readFileSync(localPath, "utf8");
  const res = await fetch(url, {
    method: "PUT", headers: h,
    body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), sha: cur.sha })
  }).then(r => r.json());
  if (res.content?.sha) {
    console.log(`✓ ${path} → ${res.content.sha.slice(0, 8)}`);
  } else {
    console.error(`✗ Failed ${path}:`, JSON.stringify(res));
    process.exit(1);
  }
}

await Promise.all([
  pushFile(
    "artifacts/scribe/electron/server.ts",
    "artifacts/scribe/electron/server.ts",
    "fix: cast unknown rawText/cleanedText to string for callGroq"
  ),
  pushFile(
    "artifacts/scribe/electron/tsconfig.json",
    "artifacts/scribe/electron/tsconfig.json",
    "fix: disable noImplicitAny and useUnknownInCatchVariables in electron tsconfig"
  ),
]);

const r = await fetch(
  "https://api.github.com/repos/natethegreat78/journal/actions/workflows/build-mac.yml/dispatches",
  { method: "POST", headers: h, body: JSON.stringify({ ref: "main" }) }
);
console.log("Trigger:", r.status);
