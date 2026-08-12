import { chromium } from 'playwright';
import fs from 'fs';

const outDir='audit-results'; fs.mkdirSync(outDir,{recursive:true});
const findings=[]; const checks=[];
const add=(severity,code,title,evidence,impact)=>findings.push({severity,code,title,evidence,impact});
const check=(name,ok,details)=>checks.push({name,ok,details});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
const consoleErrors=[]; const pageErrors=[]; const failedRequests=[]; const requests=[];
page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });
page.on('pageerror',e=>pageErrors.push(String(e)));
page.on('request',r=>requests.push(r.url()));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));

const url='http://127.0.0.1:8000/beta_2_heart_at_crossroads/heart_at_crossroads.html';
await page.goto(url,{waitUntil:'domcontentloaded'});
await page.evaluate(()=>localStorage.clear());
await page.evaluate(()=>localStorage.setItem('tempAccessGranted','true'));
await page.reload({waitUntil:'domcontentloaded'});

// Prove beta2 runtime resource routing.
await page.click('#start-game');
await page.waitForTimeout(2500);
const originalPathRequests=requests.filter(u=>u.includes('/heart_at_crossroads/'));
check('beta2 loaded page',true,url);
check('beta2 uses own base path',originalPathRequests.length===0,{count:originalPathRequests.length,sample:originalPathRequests.slice(0,10)});
if(originalPathRequests.length){
  add('P0','RUNTIME_BASE_PATH_CROSSLOAD','beta_2 runtime requests the original /heart_at_crossroads path',
      `${originalPathRequests.length} requests observed; e.g. ${originalPathRequests.slice(0,4).join(', ')}`,
      'beta_2 tests can execute original assets/data or fail when original Pages path is unavailable.');
}

// Save contract: set distinctive state and persist.
let saveSnapshot;
try {
  saveSnapshot=await page.evaluate(async()=>{
    currentChapter=3; currentScene=7; stats.heart=9; choices=['audit_choice'];
    saveSession();
    await new Promise(r=>setTimeout(r,200));
    return {gameSession:localStorage.getItem('gameSession'),last_session:localStorage.getItem('last_session')};
  });
  const parsed=saveSnapshot.gameSession ? JSON.parse(saveSnapshot.gameSession) : null;
  check('saveSession writes current state',parsed?.currentChapter===3 && parsed?.currentScene===7,saveSnapshot);
  check('saveSession writes key read by loadSession',!!saveSnapshot.last_session,saveSnapshot);
  if(saveSnapshot.gameSession && !saveSnapshot.last_session){
    add('P0','RUNTIME_SAVE_KEY_MISMATCH','Runtime save writes gameSession while load path expects last_session',JSON.stringify(saveSnapshot),'Continue cannot restore current saves.');
  }
}catch(e){ add('P0','RUNTIME_SAVE_CRASH','saveSession runtime test crashed',String(e),'Persistence cannot be trusted.'); }

// Load with only gameSession present: should restore but does not.
try {
  const result=await page.evaluate(async()=>{
    currentChapter=1; currentScene=0; stats.heart=0; choices=[];
    localStorage.removeItem('last_session');
    await loadSession();
    return {currentChapter,currentScene,heart:stats.heart,choices};
  });
  check('loadSession restores saveSession output',result.currentChapter===3 && result.currentScene===7 && result.heart===9,result);
  if(!(result.currentChapter===3 && result.currentScene===7)) add('P0','RUNTIME_CONTINUE_NO_RESTORE','loadSession does not restore the save produced by saveSession',JSON.stringify(result),'Continue silently resumes wrong/default state.');
}catch(e){ add('P0','RUNTIME_LOAD_CRASH','loadSession runtime test crashed',String(e),'Continue path is broken.'); }

// Even if key is renamed, serialized string is not parsed.
try {
  const result=await page.evaluate(async()=>{
    localStorage.setItem('last_session',JSON.stringify({currentChapter:4,currentScene:5,stats:{heart:12},choices:['x']}));
    currentChapter=1; currentScene=0; stats.heart=0; choices=[];
    await loadSession();
    return {currentChapter,currentScene,heart:stats.heart,choicesType:typeof choices,choices};
  });
  check('loadSession parses serialized payload',result.currentChapter===4 && result.currentScene===5 && result.heart===12,result);
  if(result.currentChapter!==4 || result.currentScene!==5) add('P0','RUNTIME_SESSION_PARSE_BUG','loadSession treats serialized JSON string as an object',JSON.stringify(result),'Fixing only the storage key still leaves restore corrupted.');
}catch(e){ add('P0','RUNTIME_SESSION_PARSE_CRASH','Serialized last_session causes load failure',String(e),'Restore can crash/corrupt state.'); }

// Ending requirement parser.
try {
 const result=await page.evaluate(()=>{stats.crown=100;stats.heart=1;stats.leaf=1;return checkRequirements({crown:'> heart + leaf'});});
 check('lonely_path expression evaluates',result===true,{result});
 if(result!==true) add('P0','RUNTIME_LONELY_UNREACHABLE','lonely_path requirement expression evaluates false even with crown=100, heart=1, leaf=1',`checkRequirements returned ${result}`,'The lonely ending is unreachable through its declared rule.');
}catch(e){add('P0','RUNTIME_REQUIREMENT_CRASH','Ending requirement evaluation crashed',String(e),'Ending routing is broken.');}

// Pending ending is not persisted.
try {
 const result=await page.evaluate(async()=>{
   window.pendingEndingId='silence_with_mark'; currentChapter=10; currentScene=7;
   saveSession(); await new Promise(r=>setTimeout(r,200));
   const raw=localStorage.getItem('gameSession'); return {raw,hasPending:raw?.includes('pendingEndingId')||false};
 });
 check('selected ending survives persistence',result.hasPending,result);
 if(!result.hasPending) add('P0','RUNTIME_ENDING_CONTEXT_LOST','Selected ending is absent from persisted state',result.raw,'Reload after the final choice loses route context; terminal scene can fall through incorrectly.');
}catch(e){add('P0','RUNTIME_ENDING_PERSIST_CRASH','Ending persistence test crashed',String(e),'Final-route recovery is unsafe.');}

// Intentional menu behavior: record as invariant, not a defect.
try {
 const result=await page.evaluate(()=>{
   currentChapter=6;currentScene=3;stats.heart=8;resetGameState();
   return {currentChapter,currentScene,heart:stats.heart,diamonds:stats.diamonds,completionCount:stats.completionCount};
 });
 check('intentional menu/new-run reset primitive resets current run',result.currentChapter===1&&result.currentScene===0&&result.heart===0,result);
}catch(e){check('intentional reset primitive callable',false,String(e));}

// startGame failure-path behavior: monkey patch loadChapter to false and showScene to count.
try {
 const result=await page.evaluate(async()=>{
   const oldLoad=loadChapter; const oldShow=showScene; const oldPre=preloadAssets;
   let shown=0;
   preloadAssets=async()=>({success:0,failed:0}); loadChapter=async()=>false; showScene=async()=>{shown++};
   try{await startGame();}catch(e){}
   loadChapter=oldLoad;showScene=oldShow;preloadAssets=oldPre;
   document.getElementById('loading-overlay')?.remove();
   return {shown};
 });
 check('startGame stops when loadChapter returns false',result.shown===0,result);
 if(result.shown>0) add('P0','RUNTIME_START_AFTER_LOAD_FAIL','startGame calls showScene after loadChapter reports failure',JSON.stringify(result),'Corrupt/missing chapter data can cascade into stale/null scene state.');
}catch(e){add('P1','RUNTIME_FAILURE_PATH_TEST_ERROR','Could not exercise startGame failure path',String(e),'Failure handling remains unverified.');}

// Input model inventory via monkey-patching is impractical after listeners attached; record observed source behavior separately in static audit.

await page.screenshot({path:`${outDir}/browser-start.png`,fullPage:true});
await browser.close();

const summary={P0:findings.filter(f=>f.severity==='P0').length,P1:findings.filter(f=>f.severity==='P1').length,P2:findings.filter(f=>f.severity==='P2').length};
const report={url,summary,checks,findings,consoleErrors,pageErrors,failedRequests,requestSample:requests.slice(0,100)};
fs.writeFileSync(`${outDir}/browser-audit.json`,JSON.stringify(report,null,2));
let md='# Browser runtime audit\n\n'+`Summary: ${JSON.stringify(summary)}\n\n`;
for(const c of checks) md+=`- ${c.ok?'PASS':'FAIL'} ${c.name}: ${JSON.stringify(c.details)}\n`;
for(const f of findings) md+=`\n## ${f.severity} ${f.code}: ${f.title}\n\nEvidence: ${f.evidence}\n\nImpact: ${f.impact}\n`;
md+='\n## Runtime errors\n\n'+`pageErrors=${JSON.stringify(pageErrors)}\n\nconsoleErrors=${JSON.stringify(consoleErrors.slice(0,30))}\n\nfailedRequests=${JSON.stringify(failedRequests.slice(0,30))}\n`;
fs.writeFileSync(`${outDir}/browser-audit.md`,md);
console.log(JSON.stringify(summary));
for(const f of findings) console.log(`${f.severity} ${f.code}: ${f.title}`);
