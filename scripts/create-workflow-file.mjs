import { readFileSync } from "fs";

const content = readFileSync(".github/workflows/build-mac.yml", "utf8");
const encoded = Buffer.from(content).toString("base64");
const token = process.env.GITHUB_TOKEN;

if (!token) { console.error("No GITHUB_TOKEN"); process.exit(1); }

// Check if file already exists (need its SHA to update it)
const check = await fetch(
  "https://api.github.com/repos/natethegreat78/journal/contents/.github/workflows/build-mac.yml",
  { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" } }
);
const existing = check.ok ? await check.json() : null;

const body = {
  message: "Add GitHub Actions workflow to build Mac DMG",
  content: encoded,
  branch: "main",
};
if (existing?.sha) body.sha = existing.sha;

const res = await fetch(
  "https://api.github.com/repos/natethegreat78/journal/contents/.github/workflows/build-mac.yml",
  {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }
);

const data = await res.json();
console.log("HTTP status:", res.status);
if (res.ok) {
  console.log("Success! File created at:", data.content?.html_url);
} else {
  console.error("Failed:", JSON.stringify(data));
}
