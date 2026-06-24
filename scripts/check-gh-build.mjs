const t = process.env.GH_PUSH_TOKEN;
const h = { Authorization: `token ${t}`, Accept: "application/vnd.github+json" };

// Get latest 2 runs
const d = await fetch("https://api.github.com/repos/natethegreat78/journal/actions/runs?per_page=2", { headers: h }).then(r => r.json());
for (const run of d.workflow_runs || []) {
  console.log(`\n=== Run: ${run.display_title} | ${run.status} | ${run.conclusion} | ${run.created_at} ===`);
  const jobs = await fetch(run.jobs_url, { headers: h }).then(r => r.json());
  for (const job of jobs.jobs || []) {
    console.log(`  Job: ${job.name} | ${job.status} | ${job.conclusion}`);
    for (const step of job.steps || []) {
      const icon = step.conclusion === "failure" ? "❌FAIL" : step.conclusion === "success" ? "✓" : step.conclusion ?? step.status;
      console.log(`    [${icon}] ${step.name}`);
    }
  }
}
