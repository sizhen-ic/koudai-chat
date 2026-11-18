const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H={'User-Agent':'p',Accept:'application/vnd.github+json'};
(async()=>{
  for(let i=0;i<20;i++){
    const r=await fetch('https://api.github.com/repos/sizhen-ic/koudai-chat/actions/runs?per_page=1',{headers:H});
    if(r.ok){
      const j=await r.json();
      const run=j.workflow_runs&&j.workflow_runs[0];
      if(run){
        console.log(`#${run.run_number} ${run.status}/${run.conclusion||'-'}  ${run.display_title||''}`);
        if(run.status==='completed'){console.log('URL:',run.html_url);return;}
      }
    }
    await sleep(12000);
  }
  console.log('超时');
})();
