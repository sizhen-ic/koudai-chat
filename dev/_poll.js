const OWNER = 'sizhen-ic', REPO = 'koudai-chat';
const H = { 'User-Agent': 'probe', Accept: 'application/vnd.github+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function j(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}

(async () => {
  const started = Date.now();
  let run = null;
  while (Date.now() - started < 540000) {
    const runs = await j(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=1`);
    run = runs.workflow_runs[0];
    if (!run) { await sleep(5000); continue; }
    if (run.status === 'completed') break;
    process.stdout.write('.');
    await sleep(8000);
  }
  console.log(`\nrun #${run.run_number}  ${run.status}/${run.conclusion}  ${run.html_url}`);

  const jobs = await j(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs`);
  for (const job of jobs.jobs) {
    console.log(`\n岗位 ${job.name}: ${job.conclusion}`);
    for (const s of job.steps) {
      const mark = s.conclusion === 'failure' ? '✗' : s.conclusion === 'success' ? '✓' : '·';
      console.log(`  ${mark} ${String(s.number).padStart(2)} ${s.name}  [${s.conclusion || s.status}]`);
    }
  }
  console.log('\nRUN_ID=' + run.id);
})().catch((e) => { console.log('ERR ' + e.message); process.exit(1); });
