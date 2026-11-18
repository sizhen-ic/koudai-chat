const H={'User-Agent':'p',Accept:'application/vnd.github+json'};
(async()=>{
  const r=await fetch('https://api.github.com/repos/sizhen-ic/koudai-chat/commits/main/check-runs?per_page=5',{headers:H});
  console.log('check-runs', r.status);
  if(!r.ok){ console.log(await r.text()); return; }
  const j=await r.json();
  for(const c of j.check_runs||[]){
    console.log(c.name, c.conclusion, c.id);
    const a=await fetch(`https://api.github.com/repos/sizhen-ic/koudai-chat/check-runs/${c.id}/annotations`,{headers:H});
    if(a.ok){
      const list=await a.json();
      for(const x of list) console.log('  ['+x.annotation_level+']', x.path, x.start_line, (x.message||'').slice(0,300));
    } else console.log('  annotations', a.status);
  }
})();
