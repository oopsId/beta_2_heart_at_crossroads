import { chromium } from 'playwright';
import fs from 'fs';
const outDir='audit-results';fs.mkdirSync(outDir,{recursive:true});
const checks=[];const findings=[];const check=(name,ok,details)=>checks.push({name,ok,details});const add=(severity,code,title,evidence,impact)=>findings.push({severity,code,title,evidence,impact});
const url='http://127.0.0.1:8000/beta_2_heart_at_crossroads/heart_at_crossroads.html';
const browser=await chromium.launch({headless:true});

// 1. Telegram API contract simulation: official API is callback-based and returns CloudStorage.
{
 const ctx=await browser.newContext();const p=await ctx.newPage();await p.goto(url,{waitUntil:'domcontentloaded'});
 const r=await p.evaluate(async()=>{
   const cs=window.Telegram?.WebApp?.CloudStorage;if(!cs)return {supported:false};
   const backing={};const oldSet=cs.setItem,oldGet=cs.getItem;
   try{
     cs.setItem=(key,value,cb)=>{backing[key]=String(value);if(typeof cb==='function')cb(null,true);return cs;};
     cs.getItem=(key,cb)=>{if(typeof cb==='function')cb(null,backing[key]||'');return cs;};
     window._inMemoryStorage={};
     await saveToStorage('audit_cloud','cloud-value');
     const memoryAfterSave=window._inMemoryStorage?.audit_cloud||null;
     window._inMemoryStorage={};
     const read=await getFromStorage('audit_cloud');
     return {supported:true,cloud:backing.audit_cloud||null,memoryAfterSave,read};
   }finally{cs.setItem=oldSet;cs.getItem=oldGet;}
 });
 check('callback-style Telegram CloudStorage roundtrip works through adapter',r.read==='cloud-value',r);
 if(r.supported&&r.read!=='cloud-value')add('P0','CLOUDSTORAGE_CALLBACK_RUNTIME_FAILURE','Current storage adapter fails against callback-style Telegram CloudStorage',JSON.stringify(r),'Cloud write may be issued, but adapter falls into in-memory storage and cannot reliably read it back.');
 await ctx.close();
}

// Browser-only context for transition tests.
const ctx=await browser.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();await p.route('https://telegram.org/js/telegram-web-app.js',r=>r.abort());await p.goto(url,{waitUntil:'domcontentloaded'});

// 2. Definite branch bleed: chapter 1 scene 22 is a result of one choice; runtime should not advance to sibling result 23.
try{
 const r=await p.evaluate(async()=>{
   const oldType=typeText,oldFadeOut=fadeOut,oldFadeIn=fadeIn,oldSound=playSound,oldMusic=playMusic;
   try{
     typeText=(text,el,cb)=>{isTyping=false;el.textContent=String(text);if(cb)cb();};
     fadeOut=cb=>{if(cb)cb();};fadeIn=()=>{};playSound=()=>{};playMusic=()=>{};
     await loadChapter(1);currentChapter=1;currentScene=22;currentBackground=null;window.pendingEndingId=null;
     await showScene(22);await new Promise(r=>setTimeout(r,250));
     document.querySelector('.dialogue-box').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
     await new Promise(r=>setTimeout(r,150));
     return {currentScene};
   }finally{typeText=oldType;fadeOut=oldFadeOut;fadeIn=oldFadeIn;playSound=oldSound;playMusic=oldMusic;}
 });
 check('chapter 1 choice result 22 does not fall into sibling 23',r.currentScene===22,r);
 if(r.currentScene===23)add('P0','BRANCH_BLEED_RUNTIME_CONFIRMED','Chapter 1 result scene 22 advances into mutually exclusive result scene 23',JSON.stringify(r),'A player can receive multiple contradictory outcomes from one choice.');
}catch(e){add('P1','BRANCH_BLEED_RUNTIME_TEST_ERROR','Could not execute branch bleed test',String(e),'Graph-level finding remains statically proven.');}

// 3. Intentional menu reset must cancel abandoned async scene callbacks.
try{
 const r=await p.evaluate(async()=>{
   const oldType=typeText,oldFadeOut=fadeOut,oldFadeIn=fadeIn,oldBg=setupBackground,oldChars=setupCharacters;
   try{
     typeText=(text,el,cb)=>{isTyping=true;setTimeout(()=>{isTyping=false;if(cb)cb();},120);};
     fadeOut=cb=>{if(cb)cb();};fadeIn=()=>{};setupBackground=async()=> 'none';setupCharacters=async()=>{};
     scriptData={scenes:[{id:0,background:'none',characterLeft:null,characterRight:null,speaker:{ru:'Анна',en:'Anna'},text:{ru:'X',en:'X'},second_playthrough_text:{ru:'X',en:'X'},sound:null,music:null,nextScene:null}]};
     currentChapter=5;currentScene=0;currentBackground=null;
     showScene(0);
     await new Promise(r=>setTimeout(r,20));
     document.getElementById('menu-btn').click();
     const immediately={chapter:currentChapter,scene:currentScene,start:document.getElementById('start-screen').style.display};
     await new Promise(r=>setTimeout(r,300));
     return {immediately,after:{chapter:currentChapter,scene:currentScene,start:document.getElementById('start-screen').style.display}};
   }finally{typeText=oldType;fadeOut=oldFadeOut;fadeIn=oldFadeIn;setupBackground=oldBg;setupCharacters=oldChars;}
 });
 check('menu reset remains stable after abandoned scene callback fires',r.after.chapter===1&&r.after.scene===0,r);
 if(r.immediately.chapter===1&&r.after.chapter!==1)add('P0','MENU_STALE_CALLBACK_RUNTIME_CONFIRMED','Old scene callback mutates state after destructive menu reset',JSON.stringify(r),'The clean-slate menu rule can be undone by runtime work from the abandoned playthrough.');
}catch(e){add('P1','MENU_CANCEL_RUNTIME_TEST_ERROR','Could not execute menu cancellation test',String(e),'Static source still shows no cancellation path.');}

// 4. Timed scene without ignore default: accelerate chapter 2 scene 1 and observe no transition at timeout.
try{
 const r=await p.evaluate(async()=>{
   const oldType=typeText,oldFadeOut=fadeOut,oldFadeIn=fadeIn,oldSound=playSound,oldMusic=playMusic,oldMessenger=showMessengerOverlay;
   try{
     typeText=(text,el,cb)=>{isTyping=false;el.textContent=String(text);if(cb)cb();};fadeOut=cb=>{if(cb)cb();};fadeIn=()=>{};playSound=()=>{};playMusic=()=>{};showMessengerOverlay=()=>null;
     await loadChapter(2);const src=scriptData.scenes.find(s=>s.id===1);const scene=JSON.parse(JSON.stringify(src));scene.choices.forEach(c=>{if(c.timer)c.timer=0.05;});scriptData={...scriptData,scenes:scriptData.scenes.map(s=>s.id===1?scene:s)};currentChapter=2;currentScene=1;currentBackground=null;
     showSceneWithTimer(scene,50);await new Promise(r=>setTimeout(r,180));
     return {currentScene,choiceButtons:document.querySelectorAll('.choice-btn').length,timerExists:!!document.getElementById('timer-countdown')};
   }finally{typeText=oldType;fadeOut=oldFadeOut;fadeIn=oldFadeIn;playSound=oldSound;playMusic=oldMusic;showMessengerOverlay=oldMessenger;}
 });
 check('chapter 2 scene 1 timeout resolves to a transition',r.currentScene!==1,r);
 if(r.currentScene===1)add('P0','TIMED_TIMEOUT_RUNTIME_CONFIRMED','Chapter 2 scene 1 countdown expires without selecting a route',JSON.stringify(r),'The nominal time limit ends but game state remains on the same decision scene.');
}catch(e){add('P1','TIMED_TIMEOUT_RUNTIME_TEST_ERROR','Could not execute timed timeout test',String(e),'Static data/runtime contract still proves missing id=ignore route.');}

await ctx.close();await browser.close();
const summary={P0:findings.filter(f=>f.severity==='P0').length,P1:findings.filter(f=>f.severity==='P1').length};const report={summary,checks,findings};
fs.writeFileSync(`${outDir}/deep-runtime-audit.json`,JSON.stringify(report,null,2));let md=`# Deep runtime checks\n\nSummary: ${JSON.stringify(summary)}\n\n`;for(const c of checks)md+=`- ${c.ok?'PASS':'FAIL'} ${c.name}: ${JSON.stringify(c.details)}\n`;for(const f of findings)md+=`\n## ${f.severity} ${f.code}: ${f.title}\n\nEvidence: ${f.evidence}\n\nImpact: ${f.impact}\n`;fs.writeFileSync(`${outDir}/deep-runtime-audit.md`,md);console.log(JSON.stringify(report,null,2));
