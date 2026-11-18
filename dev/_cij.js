const H={'User-Agent':'p',Accept:'application/vnd.github+json'};
(async()=>{
  const r=await fetch('https://api.github.com/repos/sizhen-ic/koudai-chat/actions/runs/44327080910/jobs',{headers:H});
  const j=await r.json();
  for(const job of j.jobs||[]){
    console.log('JOB', job.name, job.conclusion);
    for(const s of job.steps||[]) console.log('  ', s.number, s.name, '=>', s.conclusion);
  }
})();
