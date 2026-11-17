const OWNER = 'sizhen-ic', REPO = 'koudai-chat';
const H = { 'User-Agent': 'probe', Accept: 'application/vnd.github+json' };

async function json(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) return { __status: r.status, __body: (await r.text()).slice(0, 300) };
  return r.json();
}

(async () => {
  const runs = await json(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=5`);
  if (runs.__status) { console.log('runs API:', runs.__status, runs.__body); return; }
  console.log('runs: ' + runs.total_count);
  for (const run of runs.workflow_runs.slice(0, 3)) {
    console.log(`\n=== run #${run.run_number} id=${run.id} status=${run.status} conclusion=${run.conclusion} ===`);
    const jobs = await json(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs`);
    if (jobs.__status) { console.log('  jobs API:', jobs.__status, jobs.__body); continue; }
    for (const job of jobs.jobs) {
      console.log(`  岗位 ${job.name}  ${job.status}/${job.conclusion}`);
      for (const s of job.steps) {
        const mark = s.conclusion === 'failure' ? '  ✗' : s.conclusion === 'success' ? '  ✓' : '  ·';
        console.log(`${mark} ${String(s.number).padStart(2)} ${s.name}  [${s.conclusion || s.status}]`);
      }
    }
  }
})().catch((e) => console.log('ERR ' + e.message));
