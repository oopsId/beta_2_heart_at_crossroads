// Replay text developer override.
(() => {
    const DEV_FIRST_PLAYTHROUGH_KEY = 'heart_at_crossroads_beta2:dev:force_first_playthrough';
    function devForceFirstPlaythrough(){return localStorage.getItem(DEV_FIRST_PLAYTHROUGH_KEY)==='1'}
    function setDevForceFirstPlaythrough(enabled){if(enabled)localStorage.setItem(DEV_FIRST_PLAYTHROUGH_KEY,'1');else localStorage.removeItem(DEV_FIRST_PLAYTHROUGH_KEY);if(typeof scriptData==='object'&&scriptData)applyReplayOverride(scriptData)}
    function applyReplayOverride(root){const forceFirst=devForceFirstPlaythrough(),seen=new WeakSet();function visit(value){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);if(Object.prototype.hasOwnProperty.call(value,'second_playthrough_text')){if(!Object.prototype.hasOwnProperty.call(value,'__stage0kSecondPlaythroughText'))Object.defineProperty(value,'__stage0kSecondPlaythroughText',{value:value.second_playthrough_text,writable:true,configurable:true,enumerable:false});if(forceFirst)delete value.second_playthrough_text}else if(!forceFirst&&Object.prototype.hasOwnProperty.call(value,'__stage0kSecondPlaythroughText'))value.second_playthrough_text=value.__stage0kSecondPlaythroughText;if(!forceFirst&&Object.prototype.hasOwnProperty.call(value,'__stage0kSecondPlaythroughText')&&!Object.prototype.hasOwnProperty.call(value,'second_playthrough_text'))value.second_playthrough_text=value.__stage0kSecondPlaythroughText;if(Array.isArray(value))value.forEach(visit);else Object.values(value).forEach(visit)}visit(root);return root}
    window.stage0kDevForceFirstPlaythrough=devForceFirstPlaythrough;window.stage0kSetDevForceFirstPlaythrough=setDevForceFirstPlaythrough;window.stage0kApplyReplayOverride=applyReplayOverride;
    const style=document.createElement('style');style.id='stage0k-styles';style.textContent=`
        #phone-compose-overlay{left:50%!important;top:clamp(22px,6vh,64px)!important;transform:translateX(-50%)!important;width:clamp(260px,18vw,320px)!important;height:min(480px,70vh)!important;min-width:0!important;min-height:0!important;max-height:none!important}
        #phone-compose-overlay .stage0j-phone-screen{background:#dcebd5 url('assets/backgrounds/bg_phone_ui.png') center/cover no-repeat!important}
        body.stage0j-compose-scene .dialogue-box{left:0!important;right:0!important;bottom:20%!important;width:auto!important;min-height:150px!important;max-height:50vh!important}
        #stage0k-dev-replay-control{position:fixed;left:12px;bottom:10px;z-index:5005;display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:8px;background:rgba(20,20,20,.68);color:#fff;font:12px/1.2 Arial,sans-serif;pointer-events:auto;user-select:none}
        #stage0k-dev-replay-control input{margin:0}
        @media(max-width:800px){#phone-compose-overlay{top:12px!important;width:clamp(190px,48vw,240px)!important;height:min(360px,54vh)!important}body.stage0j-compose-scene .dialogue-box{bottom:0!important;max-height:45vh!important}}
        @media(max-height:520px) and (orientation:landscape){#phone-compose-overlay{left:50%!important;top:6px!important;transform:translateX(-50%)!important;width:min(150px,24vw)!important;height:min(205px,55vh)!important;min-width:0!important;min-height:0!important}body.stage0j-compose-scene .dialogue-box{left:0!important;right:0!important;bottom:0!important;width:auto!important;min-height:140px!important;max-height:42vh!important}}
    `;document.head.appendChild(style);
    function mountDevControl(){if(document.getElementById('stage0k-dev-replay-control'))return;const label=document.createElement('label');label.id='stage0k-dev-replay-control';label.title='Только beta/dev: не изменяет completionCount и настоящий профиль.';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=devForceFirstPlaythrough();checkbox.setAttribute('aria-label','Игнорировать текст повторного прохождения');checkbox.addEventListener('change',()=>setDevForceFirstPlaythrough(checkbox.checked));const text=document.createElement('span');text.textContent='DEV: обычный текст (без replay)';label.append(checkbox,text);document.body.appendChild(label)}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountDevControl,{once:true});else mountDevControl();
    if(typeof loadChapter==='function'){const base=loadChapter;loadChapter=async function(...args){const ok=await base(...args);if(ok&&typeof scriptData==='object'&&scriptData)applyReplayOverride(scriptData);return ok}}
    if(typeof showScene==='function'){const base=showScene;showScene=async function(...args){if(typeof scriptData==='object'&&scriptData)applyReplayOverride(scriptData);return await base(...args)}}
    if(typeof showSceneWithTimer==='function'){const base=showSceneWithTimer;showSceneWithTimer=function(scene,...args){applyReplayOverride(scene);return base(scene,...args)}}
    if(typeof showEnding==='function'){const base=showEnding;showEnding=function(ending,...args){applyReplayOverride(ending);return base(ending,...args)}}
})();

// Stage 2D: final choice is always selectable; prior history grades the route instead of locking it.
(() => {
    const profiles={
        freedom_with_dima:{strong:s=>s.relationships.dima>=2&&s.heart>=12,mixed:s=>s.relationships.dima>=1||s.heart>=10},
        silence_with_mark:{strong:s=>s.relationships.mark>=3&&(s.heart>=10||s.leaf>=8),mixed:s=>s.relationships.mark>=1||s.heart>=8||s.leaf>=6},
        summit_with_sergey:{strong:s=>s.relationships.sergey>=2&&s.crown>=4,mixed:s=>s.relationships.sergey>=1||s.crown>=3},
        friendship_above_all:{strong:s=>s.relationships.vika>=1&&s.leaf>=10,mixed:s=>s.relationships.vika>=0||s.leaf>=7},
        lonely_path:{strong:s=>s.crown>=5&&s.crown+3>=s.heart&&s.crown+3>=s.leaf,mixed:s=>s.crown>=4},
        new_start:{intentional:true}
    };
    function snapshot(source=stats){return{crown:Number(source?.crown)||0,heart:Number(source?.heart)||0,leaf:Number(source?.leaf)||0,relationships:{dima:Number(source?.relationships?.dima)||0,mark:Number(source?.relationships?.mark)||0,sergey:Number(source?.relationships?.sergey)||0,vika:Number(source?.relationships?.vika)||0}}}
    function routeStrength(endingId,source=stats){const id=resolveEndingId(endingId),rule=profiles[id],state=snapshot(source);if(!rule)return{endingId:id,level:'unknown',snapshot:state};if(rule.intentional)return{endingId:id,level:'intentional',snapshot:state};if(rule.strong(state))return{endingId:id,level:'strong',snapshot:state};if(rule.mixed(state))return{endingId:id,level:'mixed',snapshot:state};return{endingId:id,level:'impulsive',snapshot:state}}
    const legacyEndingEligible=stage0iEndingEligible;
    stage0iEndingEligible=function(endingId,finalsData=stage0iFinalsCache){return Boolean(stage0iFindEnding(endingId,finalsData))};
    const baseApplyChoice=applyChoice;
    applyChoice=async function(choice,options={}){if(choice?.endingId){const result=routeStrength(choice.endingId,stats);stats.endingRouteStrength=result;window.stage2dLastRouteStrength=result}return await baseApplyChoice(choice,options)};
    loadFinals=async function(endingId,generation=runtimeGeneration){if(!isRunCurrent(generation))return false;const normalized=resolveEndingId(endingId);try{const finalsData=await stage0iEnsureFinals(generation);if(!isRunCurrent(generation)||!finalsData)return false;const ending=stage0iFindEnding(normalized,finalsData);if(!ending){showErrorMessage(stats.language==='ru'?`Финал ${normalized} не найден`:`Ending ${normalized} not found`);return false}showEnding(ending,generation);return true}catch(error){if(!isRunCurrent(generation))return false;console.error('[Stage 2D] ending load failed:',error);showErrorMessage(stats.language==='ru'?'Не удалось загрузить финал. Попробуйте ещё раз.':'Failed to load ending. Please try again.');return false}};
    window.stage2dRouteStrength=routeStrength;window.stage2dEndingSelectable=stage0iEndingEligible;window.stage2dLegacyEndingEligible=legacyEndingEligible;window.stage2dEndingProfiles=profiles;
})();
