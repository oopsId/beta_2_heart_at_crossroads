// Replay text developer override.
(() => {
    const DEV_FIRST_PLAYTHROUGH_KEY = 'heart_at_crossroads_beta2:dev:force_first_playthrough';
    const DEV_MODE = new URLSearchParams(window.location.search).get('dev') === '1';
    window.heartDevMode = DEV_MODE;
    function devForceFirstPlaythrough(){return DEV_MODE && localStorage.getItem(DEV_FIRST_PLAYTHROUGH_KEY)==='1'}
    function setDevForceFirstPlaythrough(enabled){if(!DEV_MODE)return false;if(enabled)localStorage.setItem(DEV_FIRST_PLAYTHROUGH_KEY,'1');else localStorage.removeItem(DEV_FIRST_PLAYTHROUGH_KEY);if(typeof scriptData==='object'&&scriptData)applyReplayOverride(scriptData);return true}
    function applyReplayOverride(root){const forceFirst=devForceFirstPlaythrough(),seen=new WeakSet();function visit(value){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);if(Object.prototype.hasOwnProperty.call(value,'second_playthrough_text')){if(!Object.prototype.hasOwnProperty.call(value,'__heartSecondPlaythroughText'))Object.defineProperty(value,'__heartSecondPlaythroughText',{value:value.second_playthrough_text,writable:true,configurable:true,enumerable:false});if(forceFirst)delete value.second_playthrough_text}else if(!forceFirst&&Object.prototype.hasOwnProperty.call(value,'__heartSecondPlaythroughText'))value.second_playthrough_text=value.__heartSecondPlaythroughText;if(!forceFirst&&Object.prototype.hasOwnProperty.call(value,'__heartSecondPlaythroughText')&&!Object.prototype.hasOwnProperty.call(value,'second_playthrough_text'))value.second_playthrough_text=value.__heartSecondPlaythroughText;if(Array.isArray(value))value.forEach(visit);else Object.values(value).forEach(visit)}visit(root);return root}
    window.stage0kDevForceFirstPlaythrough=devForceFirstPlaythrough;window.stage0kSetDevForceFirstPlaythrough=setDevForceFirstPlaythrough;window.stage0kApplyReplayOverride=applyReplayOverride;
    window.heartDevForceFirstPlaythrough=devForceFirstPlaythrough;window.heartSetDevForceFirstPlaythrough=setDevForceFirstPlaythrough;window.heartApplyReplayOverride=applyReplayOverride;
    function mountDevControl(){if(!DEV_MODE||document.getElementById('stage0k-dev-replay-control'))return;const label=document.createElement('label');label.id='stage0k-dev-replay-control';label.title='Только beta/dev: прохождение остаётся первым и не изменяет completionCount, награду или профиль.';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=devForceFirstPlaythrough();checkbox.setAttribute('aria-label','DEV: всегда первое прохождение');checkbox.addEventListener('change',()=>setDevForceFirstPlaythrough(checkbox.checked));const text=document.createElement('span');text.textContent='DEV: всегда первое прохождение';label.append(checkbox,text);document.body.appendChild(label)}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountDevControl,{once:true});else mountDevControl();
    if(typeof loadChapter==='function'){const base=loadChapter;loadChapter=async function(...args){const ok=await base(...args);if(ok&&typeof scriptData==='object'&&scriptData)applyReplayOverride(scriptData);return ok}}
    if(typeof showScene==='function'){const base=showScene;showScene=async function(...args){if(typeof scriptData==='object'&&scriptData)applyReplayOverride(scriptData);return await base(...args)}}
    if(typeof showSceneWithTimer==='function'){const base=showSceneWithTimer;showSceneWithTimer=function(scene,...args){applyReplayOverride(scene);return base(scene,...args)}}
    if(typeof showEnding==='function'){const base=showEnding;showEnding=function(ending,...args){applyReplayOverride(ending);return base(ending,...args)}}
    if(typeof showEpilogue==='function'){
        const base=showEpilogue;
        showEpilogue=function(epilogueText,generation=runtimeGeneration){
            if(!devForceFirstPlaythrough())return base(epilogueText,generation);
            if(!isRunCurrent(generation))return false;
            const epilogueDiv=document.createElement('div');
            epilogueDiv.className='epilogue-overlay';
            epilogueDiv.style.cssText='position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); color: white; display: flex; justify-content: center; align-items: center; text-align: center; padding: 20px; z-index: 10;';
            epilogueDiv.textContent=epilogueText;
            document.body.appendChild(epilogueDiv);
            runtimeSetTimeout(async()=>{
                if(!isRunCurrent(generation))return;
                epilogueDiv.remove();
                await deleteRun();
                if(!isRunCurrent(generation))return;
                invalidateRuntimeSession('ending-complete-dev-first');
                resetGameState(false);
                showStartScreen();
            },5000,generation);
            return true;
        };
    }
})();

// Stage 2D: final choice is always selectable; prior history grades the route instead of locking it.
(() => {
    const profiles={
        freedom_with_dima:{strong:s=>s.relationships.dima>=2&&s.heart>=12,mixed:s=>s.relationships.dima>=1||s.heart>=10},
        silence_with_mark:{strong:s=>s.relationships.mark>=4&&s.heart>=12&&s.leaf>=8,mixed:s=>s.relationships.mark>=2||s.heart>=10||s.leaf>=8},
        summit_with_sergey:{strong:s=>s.relationships.sergey>=3&&s.crown>=5,mixed:s=>s.relationships.sergey>=1||s.crown>=3},
        friendship_above_all:{strong:s=>s.relationships.vika>=1&&s.leaf>=10,mixed:s=>s.relationships.vika>=0||s.leaf>=7},
        lonely_path:{strong:s=>s.crown>=4&&s.crown+4>=s.heart&&s.crown+4>=s.leaf,mixed:s=>s.crown>=3},
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
    window.heartRouteStrength=routeStrength;window.heartEndingSelectable=stage0iEndingEligible;window.heartEndingProfiles=profiles;
})();
