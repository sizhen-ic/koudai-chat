const H={'User-Agent':'p',Accept:'application/vnd.github+json'};
(async()=>{
  const r=await fetch('https://api.github.com/repos/sizhen-ic/koudai-chat/actions/runs/44327080910/jobs',{headers:H});
  const j=await r.json();
  const job=j.jobs[0];
  const lr=await fetch(`https://api.github.com/repos/sizhen-ic/koudai-chat/actions/jobs/${job.id}/logs`,{headers:H,redirect:'follow'});
  console.log('status',lr.status);
  const t=await lr.text();
  const lines=t.split('\n');
  const idx=lines.findIndex(l=>/FAILURE|error:|What went wrong/i.test(l));
  const start=Math.max(0, (idx<0?lines.length-60:idx-12));
  console.log(lines.slice(start,start+45).join('\n'));
})();
