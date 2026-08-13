import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1808,height:678}});
const assert=(c,m,d='')=>{if(!c)throw new Error(`${m}${d?`: ${d}`:''}`)};
const url=process.env.GAME_URL||'http://127.0.0.1:8000/heart_at_crossroads.html';
await page.goto(url,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>typeof stage0oReadDiamondBank==='function'&&typeof stage0oWriteDiamondBank==='function'&&stage0oCompletionReward===100);

const phone=await page.evaluate(async()=>{
  const generation=beginRuntimeSession('0o-phone');resetGameState(false);currentChapter=2;currentScene=1;
  scriptData=await(await fetch('assets/data/chapter2.json')).json();const scene=scriptData.scenes.find(x=>x.id===1);
  document.getElementById('game-container').style.display='block';const dialogue=document.querySelector('.dialogue-box');dialogue.style.display='flex';document.body.classList.add('stage0j-compose-scene');
  const oldType=typeText,oldSound=playSound,oldMusic=playMusic;
  try{typeText=(text,el,cb)=>{el.textContent=text;cb?.();return true};playSound=()=>null;playMusic=()=>null;showSceneWithTimer(scene,generation);await new Promise(r=>setTimeout(r,180));
    const p=document.getElementById('phone-compose-overlay').getBoundingClientRect(),d=dialogue.getBoundingClientRect(),t=document.getElementById('dialogue-text').getBoundingClientRect(),cs=getComputedStyle(dialogue);return{top:p.top,bottom:p.bottom,height:p.height,textTop:t.top,gap:t.top-p.bottom,dialogueTop:d.top,dialogueBottom:d.bottom,dialogueHeight:d.height,bottomGap:innerHeight-d.bottom,viewportHeight:innerHeight,minHeight:cs.minHeight,maxHeight:cs.maxHeight};
  }finally{typeText=oldType;playSound=oldSound;playMusic=oldMusic;document.getElementById('phone-compose-overlay')?.remove();document.body.classList.remove('stage0j-compose-scene');invalidateRuntimeSession('0o-phone-done')}
});
assert(phone.top<=6,'Phone is not at top edge',JSON.stringify(phone));assert(phone.bottom<phone.dialogueTop&&phone.gap>=8,'Phone still covers authored dialogue strip',JSON.stringify(phone));assert(Math.abs(phone.bottomGap-phone.viewportHeight*.2)<=2,'Phone scene moved original dialogue strip away from bottom:20%',JSON.stringify(phone));assert(phone.minHeight==='150px','Phone scene changed original dialogue min-height',JSON.stringify(phone));

const economy=await page.evaluate(async()=>{
  profileState=normalizeProfile(DEFAULT_PROFILE_STATE);stage0oWriteDiamondBank(70);resetGameState(false);stats.diamonds=70;stats.completionCount=0;await saveProfile();
  const generation=beginRuntimeSession('0o-reward');showEpilogue('Smoke',generation);const immediate={diamonds:stats.diamonds,count:stats.completionCount,bank:stage0oReadDiamondBank(),visible:!!document.querySelector('.epilogue-overlay')};
  await new Promise(r=>setTimeout(r,5300));return{immediate,after:{diamonds:stats.diamonds,bank:stage0oReadDiamondBank(),visible:!!document.querySelector('.epilogue-overlay'),active:runtimeActive}};
});
assert(economy.immediate.diamonds===70&&economy.immediate.bank===70&&economy.immediate.count===0&&economy.immediate.visible,'Reward happened before ending completion',JSON.stringify(economy));
assert(economy.after.diamonds===170&&economy.after.bank===170&&!economy.after.visible&&!economy.after.active,'Completed run did not persist exactly +100 diamonds',JSON.stringify(economy));
console.log(JSON.stringify({status:'PASS',phone,economy},null,2));await browser.close();
