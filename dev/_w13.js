const fs=require('node:fs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H={'User-Agent':'p'};
async function tf(u,o){for(let k=0;k<3;k++){try{return await fetch(u,o);}catch(e){await sleep(3000);}}return null;}
(async()=>{
  for(let i=0;i<40;i++){
    for(const n of [13,14]){
      const url=`https://github.com/sizhen-ic/koudai-chat/releases/download/v1.0.${n}/app-debug.apk`;
      const r=await tf(url,{method:'HEAD',headers:H,redirect:'follow'});
      if(r&&r.ok){
        const g=await tf(url,{headers:H,redirect:'follow'});
        const b=Buffer.from(await g.arrayBuffer());
        fs.writeFileSync(`C:/Users/zhenge/Documents/deepseek-harness/default-workspace/phone-chat/build/v1${n}.apk`,b);
        console.log(`\n✓ v1.0.${n} 就绪 `+(b.length/1024).toFixed(0)+' KB');
        return;
      }
    }
    process.stdout.write('.'); await sleep(15000);
  }
  console.log('\n超时');
})();
