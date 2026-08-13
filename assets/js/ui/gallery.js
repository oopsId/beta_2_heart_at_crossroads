// Stage 0N: restore shoebox + Flip 3D gallery and manual replay unlocks.
(() => {
  const all = () => cardSeries?.romance?.cards || [];
  const ru = () => stats.language === 'ru';
  const unlocked = c => Array.isArray(stats.memories) && stats.memories.includes(c.id);
  const rule = c => {
    const a=String(c.unlock??'').toLowerCase(), b=String(c.unlockEn??'').toLowerCase();
    if(a==='второе прохождение'||b==='second playthrough') return {type:'replay',min:2,cost:0};
    const cost=Number(c.unlock); return Number.isFinite(cost)&&cost>0?{type:'diamonds',min:1,cost}:{type:'unknown',min:Infinity,cost:0};
  };
  const state = c => {
    const r=rule(c); if(unlocked(c)) return {unlocked:true,available:false,reason:'already',rule:r};
    if(stats.completionCount<r.min) return {unlocked:false,available:false,reason:r.type==='replay'?'need-second':'need-first',rule:r};
    if(r.type==='replay') return {unlocked:false,available:true,reason:'free',rule:r};
    if(r.type==='diamonds') return {unlocked:false,available:stats.diamonds>=r.cost,reason:stats.diamonds>=r.cost?'buy':'no-diamonds',rule:r};
    return {unlocked:false,available:false,reason:'unknown',rule:r};
  };
  async function unlockCard(c, pay=false){
    const s=state(c); if(s.unlocked||!s.available) return {ok:false,reason:s.reason};
    if(pay!== (s.rule.type==='diamonds')) return {ok:false,reason:'mode'};
    if(pay){stats.diamonds-=s.rule.cost;updateDiamondsDisplay();}
    stats.memories=[...new Set([...(stats.memories||[]),c.id])]; await saveProfile();
    return {ok:true,diamonds:stats.diamonds};
  }

  const css=document.createElement('style'); css.id='stage0n-gallery-styles'; css.textContent=`
  #gallery-container.stage0n{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;display:block!important;overflow:hidden!important;padding:16px!important;box-sizing:border-box!important;opacity:1!important;z-index:4000!important;background:url('assets/backgrounds/shoebox_texture.png') center/cover no-repeat!important}
  #gallery-container.stage0n::after{content:'';position:absolute;inset:8px;border:1px dashed rgba(245,230,201,.45);pointer-events:none}
  #gallery-container.stage0n.ru,#gallery-container.stage0n.ru button{font-family:GoodVibesCyr,cursive!important} #gallery-container.stage0n.en,#gallery-container.stage0n.en button{font-family:GreatVibes,cursive!important}
  .n-head,.n-sub,.n-series{position:relative;z-index:10;text-align:center;color:#f5e6c9;text-shadow:0 3px 8px #000}.n-head{font-size:clamp(34px,4vw,56px);line-height:1}.n-sub{font-size:clamp(20px,2vw,29px);color:#dec99f;margin-top:4px}.n-series{width:fit-content;margin:10px auto 0;padding:5px 18px 7px;border:1px solid rgba(224,193,142,.6);border-radius:22px;background:rgba(50,35,24,.32);font-size:clamp(18px,1.8vw,24px)}
  .n-stage{position:absolute;left:50%;top:56%;width:min(720px,92vw);height:min(490px,66vh);transform:translate(-50%,-50%);perspective:1200px;transform-style:preserve-3d;overflow:visible}
  .n-card{position:absolute;left:50%;top:50%;width:clamp(220px,22vw,290px);height:clamp(285px,29vw,375px);margin-left:calc(clamp(220px,22vw,290px)/-2);margin-top:calc(clamp(285px,29vw,375px)/-2);overflow:hidden;border-radius:9px;border:5px solid #e6d2b5;background:#d7bd91;box-shadow:0 15px 38px rgba(0,0,0,.48);cursor:pointer;transform-style:preserve-3d;backface-visibility:hidden;will-change:transform,opacity}
  .n-card[data-selected='1']{box-shadow:0 0 28px rgba(224,193,142,.75),0 18px 42px rgba(0,0,0,.58)} .n-card>img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
  .n-film{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.13),transparent 34%,rgba(255,255,255,.05) 62%,transparent)}
  .n-name{position:absolute;left:0;right:0;bottom:0;padding:34px 10px 10px;color:#fff8e9;text-align:center;font-size:clamp(19px,1.7vw,25px);line-height:1.05;text-shadow:0 2px 4px #000;background:linear-gradient(transparent,rgba(29,18,12,.84));pointer-events:none}
  .n-status{position:absolute;left:12px;right:12px;bottom:59px;padding:7px;border-radius:7px;color:#4b3527;text-align:center;background:rgba(247,236,213,.92);font-size:clamp(17px,1.45vw,22px);line-height:1.05;pointer-events:none}
  .n-unlock{position:absolute;left:50%;bottom:11px;transform:translateX(-50%);min-width:148px;padding:7px 14px 9px;border:1px solid #fff0d2;border-radius:22px;color:#fff4db;background:linear-gradient(#8c6f4a,#5a3f2a);font-size:20px;line-height:1;cursor:pointer}.n-unlock:disabled{opacity:.5}.n-card[data-selected='0'] .n-unlock{opacity:0;pointer-events:none}
  .n-arrow,.n-close{position:absolute;z-index:30;border:0;color:#e0c18e;background:rgba(35,25,18,.3);cursor:pointer}.n-arrow{top:50%;width:48px;height:64px;transform:translateY(-50%);border-radius:24px;font:52px/58px Georgia,serif!important}.n-prev{left:max(18px,calc(50% - 340px))}.n-next{right:max(18px,calc(50% - 340px))}.n-close{right:18px;top:14px;width:42px;height:42px;border:1px solid rgba(224,193,142,.55);border-radius:50%;font:30px/34px Georgia,serif!important}
  .n-detail-bg{position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0);cursor:pointer}.n-detail{position:fixed;z-index:5001;overflow:hidden;border:7px solid #e6d2b5;border-radius:8px;background:#17120e;box-shadow:0 18px 55px rgba(0,0,0,.7)}.n-detail img{width:100%;height:100%;object-fit:contain}.n-detail .n-name{font-size:clamp(25px,3vw,42px);padding-top:48px}
  @media(max-width:700px){.n-stage{top:57%;width:96vw;height:60vh}.n-card{width:clamp(190px,58vw,245px);height:clamp(250px,75vw,320px);margin-left:calc(clamp(190px,58vw,245px)/-2);margin-top:calc(clamp(250px,75vw,320px)/-2)}.n-prev{left:5px}.n-next{right:5px}.n-arrow{width:40px;height:56px;font-size:43px!important}}
  @media(max-height:570px) and (orientation:landscape){.n-head{font-size:32px}.n-sub{display:none}.n-series{margin-top:4px;font-size:17px}.n-stage{top:59%;height:72vh}.n-card{width:180px;height:235px;margin-left:-90px;margin-top:-117px}}
  `; document.head.appendChild(css);

  const statusText=c=>{const s=state(c); if(s.reason==='need-second')return ru()?'После второго прохождения':'After the second playthrough';if(s.reason==='need-first')return ru()?'После первого прохождения':'After the first playthrough';if(s.reason==='no-diamonds')return ru()?`Нужно ${s.rule.cost} 💎`:`Requires ${s.rule.cost} 💎`;if(s.reason==='free')return ru()?'Можно открыть':'Ready to unlock';if(s.reason==='buy')return ru()?`Можно открыть за ${s.rule.cost} 💎`:`Unlock for ${s.rule.cost} 💎`;return ''};
  const buttonText=c=>rule(c).type==='replay'?(ru()?'Открыть':'Unlock'):(ru()?`Открыть · ${rule(c).cost} 💎`:`Unlock · ${rule(c).cost} 💎`);

  function showGallery(){
    const g=document.getElementById('gallery-container'), start=document.getElementById('start-screen'); if(!g||!start)return false;
    g.innerHTML='';g.classList.remove('stage0m-gallery');g.classList.add('stage0n',ru()?'ru':'en');g.classList.remove(ru()?'en':'ru');g.style.display='block';start.style.display='none';document.body.style.overflow='hidden';
    let selected=0; const cs=all(), els=[]; const click=new Audio('assets/sounds/sfx_camera_click.mp3');
    const head=document.createElement('div');head.className='n-head';head.textContent=ru()?'Коллекционные карточки':'Collection Cards';
    const sub=document.createElement('div');sub.className='n-sub';sub.textContent=ru()?'Личные истории':'Personal stories';
    const series=document.createElement('div');series.className='n-series'; const stage=document.createElement('div');stage.className='n-stage';
    const prev=document.createElement('button');prev.className='n-arrow n-prev';prev.textContent='‹'; const next=document.createElement('button');next.className='n-arrow n-next';next.textContent='›'; const close=document.createElement('button');close.className='n-close';close.textContent='×';
    const updateSeries=()=>{const n=cs.filter(unlocked).length;series.textContent=`${ru()?cardSeries.romance.title:cardSeries.romance.titleEn} · ${ru()?cardSeries.romance.style:cardSeries.romance.styleEn} · ${n}/${cs.length}`};
    const renderFace=(el,c)=>{el.innerHTML='';const img=document.createElement('img');img.src=unlocked(c)?`assets/memories/${c.id}.png`:'assets/memories/card_locked.png';img.alt=ru()?c.name:c.nameEn;el.append(img);const film=document.createElement('div');film.className='n-film';el.append(film);const name=document.createElement('div');name.className='n-name';name.textContent=ru()?c.name:c.nameEn;el.append(name);if(!unlocked(c)){const st=document.createElement('div');st.className='n-status';st.textContent=statusText(c);el.append(st);const s=state(c);if(['free','buy','no-diamonds'].includes(s.reason)){const b=document.createElement('button');b.className='n-unlock';b.textContent=buttonText(c);b.disabled=!s.available;b.onclick=async e=>{e.stopPropagation();if(!s.available)return;const pay=s.rule.type==='diamonds',r=await unlockCard(c,pay);if(!r.ok)return;const redraw=()=>{renderFace(el,c);layout(true);updateSeries()};if(window.gsap){gsap.to(el,{rotateY:88,duration:.2,ease:'power2.in',onComplete:()=>{redraw();gsap.set(el,{rotateY:-88});gsap.to(el,{rotateY:0,duration:.34,ease:'back.out(1.25)'})}})}else redraw()};el.append(b)}}};
    const detail=(c,el)=>{if(!unlocked(c))return;const r=el.getBoundingClientRect(),bg=document.createElement('div'),d=document.createElement('div');bg.className='n-detail-bg';d.className='n-detail';Object.assign(d.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});const im=document.createElement('img');im.src=`assets/memories/${c.id}.png`;const nm=document.createElement('div');nm.className='n-name';nm.textContent=ru()?c.name:c.nameEn;d.append(im,nm);document.body.append(bg,d);const size=Math.min(innerWidth*.68,innerHeight*.76,720),L=(innerWidth-size)/2,T=(innerHeight-size)/2;const quit=()=>{bg.onclick=null;if(window.gsap){gsap.to(bg,{backgroundColor:'rgba(0,0,0,0)',duration:.25});gsap.to(d,{left:r.left,top:r.top,width:r.width,height:r.height,duration:.36,onComplete:()=>{bg.remove();d.remove()}})}else{bg.remove();d.remove()}};bg.onclick=quit;d.onclick=e=>e.stopPropagation();if(window.gsap){gsap.to(bg,{backgroundColor:'rgba(0,0,0,.86)',duration:.3});gsap.to(d,{left:L,top:T,width:size,height:size,duration:.48,ease:'power3.out'})}else Object.assign(d.style,{left:L+'px',top:T+'px',width:size+'px',height:size+'px'})};
    cs.forEach((c,i)=>{const el=document.createElement('div');el.className='n-card';el.dataset.cardId=c.id;el.onclick=e=>{if(e.target.closest('.n-unlock'))return;if(i!==selected){select(i);return}detail(c,el)};stage.append(el);els.push(el)});
    function layout(anim=true){g.dataset.selectedIndex=String(selected);els.forEach((el,i)=>{const rel=(i-selected+cs.length)%cs.length,x=rel===0?-34:24+rel*54,y=rel===0?0:-rel*18,z=-rel*155,rot=rel===0?0:-8-rel*5,sc=1-rel*.045,op=Math.max(.5,1-rel*.14);el.style.zIndex=String(cs.length-rel+10);el.dataset.selected=rel===0?'1':'0';renderFace(el,cs[i]);if(window.gsap)gsap.to(el,{x,y,z,rotateY:rot,scale:sc,opacity:op,duration:anim?.62:0,ease:'power2.inOut'});else el.style.transform=`translate3d(${x}px,${y}px,${z}px) rotateY(${rot}deg) scale(${sc})`})}
    function select(i){selected=(i+cs.length)%cs.length;layout(true);click.currentTime=0;click.play().catch(()=>{})}
    function quit(){document.removeEventListener('keydown',keys);document.querySelector('.n-detail-bg')?.remove();document.querySelector('.n-detail')?.remove();g.innerHTML='';g.classList.remove('stage0n','ru','en');g.style.display='none';document.body.style.overflow='';start.style.display='flex'}
    const keys=e=>{if(e.key==='ArrowLeft')select(selected-1);else if(e.key==='ArrowRight')select(selected+1);else if(e.key==='Escape')quit();else if(e.key==='Enter'&&unlocked(cs[selected]))detail(cs[selected],els[selected])};document.addEventListener('keydown',keys);prev.onclick=()=>select(selected-1);next.onclick=()=>select(selected+1);close.onclick=quit;
    g.append(head,sub,series,stage,prev,next,close);updateSeries();layout(false);if(window.gsap)gsap.fromTo(stage,{opacity:0,scale:.96},{opacity:1,scale:1,duration:.5,ease:'power2.out'});return true;
  }
  showPremiumGallery=showGallery; showSimpleGallery=showGallery;
  window.stage0mSyncGalleryProgress=async()=>false;
  window.stage0nGalleryRule=rule; window.stage0nGalleryAvailability=state; window.stage0nUnlockGalleryCard=unlockCard; window.stage0nShowGallery=showGallery;
})();