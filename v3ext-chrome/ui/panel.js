import { fromPanelState } from '../strategy_v1/state_reader.js';

// Strategy entrypoints
// V1 – используем исходные файлы из extension-shop/strategy
async function runV1(state, risk){
  const planner = await import('../strategy_v1/planner.js');
  return planner.buildPlan({state, risk});
}
// V2 – используем файлы из v2ext/strategy (profit-dominance)
async function runV2(state, risk){
  const planner = await import('../strategy_v2/planner.js');
  return planner.buildPlan({state, risk, profitDominance:true});
}

async function getGameTabByUrl(){
  const candidates = await browser.tabs.query({ url: ['*://cats.hr.alabuga.ru/*','*://game.hr.alabuga.ru/*','*://hr.alabuga.ru/*'] });
  const active = candidates.find(t=>t.active);
  if(active) return active;
  if(candidates.length) return candidates[0];
  const fallbacks = await browser.tabs.query({active:true, currentWindow:true});
  return fallbacks[0];
}
async function ensureContentScriptLoaded(tabId){
  try{ await browser.tabs.sendMessage(tabId, { type: 'BC_SHOP_V3_PING' }); return true; }
  catch(e){ try{ await browser.tabs.executeScript(tabId, { file: 'content_script.js' }); await new Promise(r=>setTimeout(r,200)); return true; } catch(e2){ return false; } }
}
async function findGameTab(){
  let tab = await getGameTabByUrl();
  if(tab){
    try{ const ok = await ensureContentScriptLoaded(tab.id); if(ok){ const resp = await browser.tabs.sendMessage(tab.id, { type: 'BC_SHOP_V3_GET_STATE' }); if(resp?.ok && (resp.json || resp.state)) return tab; } }catch(e){}
  }
  const win = await browser.windows.getCurrent();
  const tabs = await browser.tabs.query({ windowId: win.id });
  for(const t of tabs){
    try{ const ok = await ensureContentScriptLoaded(t.id); if(!ok) continue; const resp = await browser.tabs.sendMessage(t.id, { type: 'BC_SHOP_V3_GET_STATE' }); if(resp?.ok && (resp.json || resp.state)){ return t; } }catch(e){}
  }
  return tab;
}

function readRiskFromUI(){
  const riskPctEl = document.getElementById('bc-risk-pct');
  const riskAbsEl = document.getElementById('bc-risk-abs');
  const pct = Math.max(0, Math.min(90, parseInt((riskPctEl?.value)||'15',10)));
  const abs = Math.max(0, parseInt((riskAbsEl?.value)||'30',10));
  return { reservePct: pct/100, reserveAbs: abs };
}

function selectedStrategy(){
  const rad = Array.from(document.querySelectorAll('input[name="bc-strategy"]'));
  const v = rad.find(r=>r.checked)?.value || 'v1';
  return v;
}

async function fetchState(){
  const tab = await findGameTab();
  if(!tab) throw new Error('Не найдена вкладка игры');
  const ok = await ensureContentScriptLoaded(tab.id);
  if(!ok) throw new Error('Не удалось инжектировать скрипт');
  const resp = await browser.tabs.sendMessage(tab.id, { type: 'BC_SHOP_V3_GET_STATE' });
  const json = resp?.json ?? null; const stateObj = resp?.state ?? null;
  if(!resp?.ok || (!json && !stateObj)) throw new Error(resp?.error||'state is null');
  try{ return json ? JSON.parse(json) : JSON.parse(JSON.stringify(stateObj)); }catch(e){ throw new Error('state_parse_failed'); }
}

function render(state){
  const season = state?.season ?? state?.timers?.season ?? '—';
  const balance = (state?.balance!=null) ? state.balance : '—';
  document.getElementById('bc-season').textContent = `сезон: ${season}`;
  document.getElementById('bc-balance').textContent = `баланс: ${balance}`;
}
function renderReco(text){ document.getElementById('bc-reco-text').textContent = text; }
function li(text, done){ const el=document.createElement('li'); el.textContent=text; if(done) el.classList.add('done'); return el; }

const COLOR_DOT = { white: '⚪️', black: '⚫️', gray: '⚙️', ginger: '🟠' };
const GENDER_DOT = { male: '🔵', female: '🟣' };
function fmtKey(key){ const [gender,color]=key.split('_'); const gd=GENDER_DOT[gender]||gender; const cd=COLOR_DOT[color]||color; return `${gd} ${cd}`; }

function lastPresetChange(logs, {gender, color}, kind){
  if(!Array.isArray(logs)) return null;
  for(let i=logs.length-1;i>=0;i--){
    const e = logs[i]; if(e?.dir!=='out') continue; const d = e?.data||{}; const msg = (d.msg_type||d.type)||e.kind; if(msg!=='change_preset_price') continue; const payload = d.data||d;
    if(payload?.gender===gender && payload?.color===color){ if(kind==='sell' && payload.sell_price!=null) return Number(payload.sell_price); if(kind==='buy' && payload.buy_price!=null) return Number(payload.buy_price); }
  }
  return null;
}

function renderChecklist(plan, state, logs){
  const list = document.getElementById('bc-checklist'); if(!list) return; list.innerHTML = '';
  if(!plan){ list.appendChild(li('Нет действий. Ждём следующий сезон.', false)); return; }
  let tasks = 0;
  (plan.showcase||[]).slice(0,8).forEach(r=>{
    let current = state.showcase.get(r.key)?.price ?? null;
    if(current==null){ const self = (state.shops||[]).find(sh=> sh.uuid===state.me); const p = self?.price?.get(r.key); if(p && p.sell_price!=null) current = p.sell_price; }
    let done = current!=null && Number(current)===Number(r.targetPrice);
    if(!done){ const latest = lastPresetChange(logs, {gender:r.gender,color:r.color}, 'sell'); if(latest!=null && Number(latest)===Number(r.targetPrice)) done = true; }
    if(!done){ list.appendChild(li(`Витрина (продажа): ${fmtKey(r.key)} → установить цену ${r.targetPrice}`, false)); tasks++; }
  });
  (plan.buyPrices||[]).slice(0,8).forEach(b=>{
    const current = (state.shops||[]).find(sh=>sh.uuid===state.me)?.price?.get(b.key)?.buy_price ?? null;
    let done = current!=null && Number(current)===Number(b.targetBuyPrice);
    if(!done){ const latest = lastPresetChange(logs, {gender:b.gender,color:b.color}, 'buy'); if(latest!=null && Number(latest)===Number(b.targetBuyPrice)) done = true; }
    if(!done){ list.appendChild(li(`Витрина (покупка): ${fmtKey(b.key)} → установить цену ${b.targetBuyPrice}`, false)); tasks++; }
  });
  if(plan.bestDeal){ plan.bestDeal.lines.forEach(x=>{ list.appendChild(li(`Закупить: ${fmtKey(x.key)} × ${x.qty} по ${x.buyPrice}`, false)); tasks++; }); }
  if(tasks===0){ list.appendChild(li('Все пункты актуальны — действий сейчас не требуется.', true)); }
}

function recoText(plan){
  const needed = plan.showcase.filter(r=> r.current==null || Number(r.current)!==Number(r.targetPrice));
  const priceLines = (needed.length? needed : plan.showcase).slice(0,4).map(r=>{
    const comp = (r.competitorBest!=null)? `, лучший конкурент: ${r.competitorBest}` : '';
    const costGuard = (r.competitorBest!=null && r.band && r.targetPrice===r.band[0] && r.band[0] > (r.competitorBest-1)) ? ' (выше конкурента из‑за минимально допустимой цены по издержкам)' : '';
    return `• Витрина (продажа): ${fmtKey(r.key)} → ${r.targetPrice} (допустимо ${r.band[0]}–${r.band[1]}${comp})${costGuard}`;
  });
  if(needed.length===0){ priceLines.unshift('• Витрины: все актуальные цены уже выставлены'); }
  const buyLines = (plan.buyPrices||[]).slice(0,4).map(b=>{ const done = (b.currentBuy!=null && Number(b.currentBuy)===Number(b.targetBuyPrice)) ? ' (уже стоит)' : ''; return `• Витрина (покупка): ${fmtKey(b.key)} → ${b.targetBuyPrice}${done}`; });
  const dealText = plan.bestDeal ? (()=>{ const n = plan.bestDeal.nursery.name||plan.bestDeal.nursery.uuid.slice(0,8); const items = plan.bestDeal.lines.map(x=>`${fmtKey(x.key)} × ${x.qty}`).join(', '); const rel = plan.bestDeal.relationDelta; const disc = plan.bestDeal.requestedDiscountPct!=null ? `, скидка ~${plan.bestDeal.requestedDiscountPct}%` : ''; const need = plan.bestDeal.neededCash; const profit = plan.bestDeal.grossProfit; return `• Закупка у питомника «${n}»: ${items}${disc}. Кэш: ${need}. Валовая прибыль: ${profit}. ∆отношений: ${rel}`; })() : '• Закупка сейчас не требуется (безопасных крупных сделок не найдено)';
  const risk = plan.risk; const riskLine = `• Риск: резерв ${Math.round(risk.reservePct*100)}% (мин. ${risk.reserveAbs})`; return ['Сделайте:', ...priceLines, ...buyLines, dealText, riskLine].join('\n');
}

async function getLogs(){ try{ const tab = await findGameTab(); const resp = await browser.tabs.sendMessage(tab.id, { type:'BC_SHOP_V3_GET_LOGS' }); if(resp?.ok && resp.json){ return JSON.parse(resp.json); } return []; }catch(e){ return []; } }
function renderOfferEvents(logs){
  const last = logs.filter(e=> e.kind==='offer_preview' || e.kind==='offer_sent').slice(-10);
  if(!last.length) return '—';
  return last.map(e=>{
    const d = e.data||{}; const partner = d.seller||d.buyer||'—'; const side = d.request_type; const lines = (d.contents||[]).map(l=>`${l.gender}/${l.color}×${l.count}@${l.price}`).join(', ');
    return `${new Date(e.t).toLocaleTimeString()} ${side} → ${partner}: ${lines}`;
  }).join('\n');
}
async function clearLogs(){ try{ const tab = await findGameTab(); await browser.tabs.sendMessage(tab.id, { type: 'BC_SHOP_V3_CLEAR_LOGS' }); }catch(e){} }

async function refresh(){
  try{
    const raw = await fetchState();
    render(raw);
    const state = fromPanelState(raw);
    const risk = readRiskFromUI();
    const strat = selectedStrategy();
    const plan = strat==='v1' ? await runV1(state, risk) : await runV2(state, risk);
    renderReco(recoText(plan));
    const logs = await getLogs();
    renderChecklist(plan, state, logs);
    const view = document.getElementById('bc-logs-view'); const last = logs.slice(-50); const offersText = renderOfferEvents(logs); view.textContent = offersText + '\n' + last.map(e=>{ const t = new Date(e.t).toLocaleTimeString(); const dir = e.dir==='in'?'⇦ in':'out ⇨'; return `${t} [${dir}] ${e.kind}`; }).join('\n');
  }catch(e){
    try{
      const tab = await findGameTab();
      const resp = await browser.tabs.sendMessage(tab.id, { type: 'BC_SHOP_V3_GET_STATE_MIN' });
      if(resp?.ok && resp.json){ const min = JSON.parse(resp.json); render(min); }
    }catch(_e){}
    renderReco('Недоступно. Откройте игру и попробуйте снова.'); console.error('BC V3 panel refresh error:', e);
  }
}

async function autotradeOnce(){
  const raw = await fetchState();
  const state = fromPanelState(raw);
  const risk = readRiskFromUI();
  const strat = selectedStrategy();
  const planner = strat==='v1' ? await import('../strategy_v1/planner.js') : await import('../strategy_v2/planner.js');
  const plan = planner.buildPlan({state, risk, profitDominance: strat==='v2'});
  // Только офферы: не меняем витринные цены
  const msgs = [];
  try{
    if(plan.bestDeal){
      const offers = strat==='v1' ? await import('../strategy_v1/offers.js') : await import('../strategy_v2/offers.js');
      // buy offer к лучшему питомнику
      const lotBuy = offers.buildBuyOffer({ nurseryUuid: plan.bestDeal.nursery.uuid, lines: plan.bestDeal.lines.map(l=>({ gender:l.gender, color:l.color, count:l.expectedSold||l.qty||1, price:l.buyPrice })) });
      msgs.push(lotBuy);
      // Дополнительно (V2): попробовать продать излишки (минимально безопасно)
      if(strat==='v2'){
        const { pickSellLinesFromShowcase, buildSellOffer } = await import('../strategy_v2/offers.js');
        const sellLines = pickSellLinesFromShowcase({state});
        if(sellLines.length){
          const lotSell = buildSellOffer({ nurseryUuid: plan.bestDeal.nursery.uuid, lines: sellLines.map(l=>({ gender:l.gender, color:l.color, count:l.count, price:l.price, detail:l.detail })) });
          msgs.push(lotSell);
        }
      }
    }
  }catch(e){ console.error('Offer build failed', e); }
  // Превью офферов в панели
  if(!msgs.length){ renderReco('Нет офферов для отправки: план не нашёл безопасных сделок.'); return; }
  const preview = msgs.map((m,i)=>{
    if(m.msg_type!=='trading_request') return `${i+1}) ${m.msg_type}`;
    const r = m.data||{}; const partner = r.seller||r.buyer||'—'; const side = r.request_type; const lines = (r.contents||[]).map(l=>`${l.gender}/${l.color}×${l.count}@${l.price}`).join(', ');
    return `${i+1}) offer ${side} → ${partner}: ${lines}`;
  }).join('\n');
  renderReco(`Отправляю офферы:\n${preview}`);
  const tab = await findGameTab();
  await ensureContentScriptLoaded(tab.id);
  const resp = await browser.tabs.sendMessage(tab.id, { type:'AUTOTRADE_MESSAGES_V3', payload: msgs });
  if(!resp?.ok){ console.warn('AUTOTRADE failed', resp?.error); renderReco(`Офферы отклонены: ${resp?.error||'unknown'}`); }
  else { renderReco(`Офферы отправлены:\n${preview}`); }
}

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('bc-done').addEventListener('click', refresh);
  document.getElementById('bc-skip').addEventListener('click', refresh);
  document.getElementById('bc-refresh-logs').addEventListener('click', refresh);
  document.getElementById('bc-clear-logs').addEventListener('click', async()=>{ await clearLogs(); await refresh(); });
  document.getElementById('bc-download-logs').addEventListener('click', async()=>{
    try{
      const tab = await findGameTab();
      const resp = await browser.tabs.sendMessage(tab.id, { type:'BC_SHOP_V3_GET_LOGS' });
      const logs = (resp?.ok && resp.json) ? JSON.parse(resp.json) : [];
      const blob = new Blob([JSON.stringify(logs,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const filename = `bc_shop_logs_${Date.now()}.json`;
      await browser.downloads.download({ url, filename, saveAs: true });
      setTimeout(()=>URL.revokeObjectURL(url), 5000);
    }catch(e){ console.error('download logs failed', e); }
  });
  setTimeout(refresh, 100);
  setInterval(refresh, 3000);

  // Офферы ручного запуска
  document.getElementById('bc-offer-buy').addEventListener('click', async()=>{
    try{ await autotradeOnce(); setTimeout(refresh, 300); }catch(e){ renderReco('Не удалось отправить оффер покупки'); }});
  document.getElementById('bc-offer-sell').addEventListener('click', async()=>{
    // Заглушка: продажа питомникам требует выбор конкретных котят (detail.cat_id); оставляем под будущую реализацию
    renderReco('Оффер продажи: требуется выбор конкретных котят — добавим позже.');
  });

  let autoTimer = null;
  const toggle = document.getElementById('bc-auto-toggle');
  const intervalEl = document.getElementById('bc-auto-interval');
  const loop = async()=>{ try{ await autotradeOnce(); setTimeout(refresh, 300); } catch(e){ toggle.checked=false; clearInterval(autoTimer); autoTimer=null; } };
  toggle.addEventListener('change',()=>{
    if(toggle.checked){ const sec = Math.max(5, parseInt(intervalEl.value||'45',10)); if(autoTimer) clearInterval(autoTimer); autoTimer = setInterval(loop, sec*1000); loop(); }
    else{ if(autoTimer) clearInterval(autoTimer); autoTimer = null; }
  });
});
