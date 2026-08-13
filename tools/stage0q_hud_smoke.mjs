import { chromium } from 'playwright';
const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:447,height:723}}),u=process.env.GAME_URL||'http://127.0.0.1:8000/heart_at_crossroads.html';
await p.goto(u,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof stage0oReadDiamondBank==='function');
await p.evaluate(()=>{document.getElementById('start-screen').style.display='none';document.getElementById('game-container').style.display='block';document.getElementById('menu').style.display='flex'});await p.hover('#menu-btn');await p.waitForTimeout(80);
const r=await p.evaluate(()=>{const s=getComputedStyle(document.getElementById('menu'));return{x:s.overflowX,y:s.overflowY}});if(r.x!=='visible'||r.y!=='visible')throw new Error(`HUD scrollbar active: ${JSON.stringify(r)}`);console.log(JSON.stringify({status:'PASS',hud:r}));await b.close();
