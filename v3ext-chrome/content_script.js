// V3 content script: same as V2 protocol to keep compatibility

const __bc_shop_logs = [];
window.addEventListener('message', (ev) => {
  const d = ev.data; if(!d || d.__BC_SHOP_V3__!==true) return;
  if(d.type==='TELEMETRY_EVENT'){ __bc_shop_logs.push(d.payload); if(__bc_shop_logs.length>4000) __bc_shop_logs.shift(); }
});

function inject(){
  const code = `(() => {
    try{
      if(window.__BC_SHOP_V3_INJECTED__) return; window.__BC_SHOP_V3_INJECTED__=true;
      const post = (payload)=> window.postMessage({__BC_SHOP_V3__:true, type:'TELEMETRY_EVENT', payload}, '*');
      const OriginalWS = window.WebSocket; let installed=false;
      const wrapWS=()=>{ if(installed) return; installed=true; const W=OriginalWS; function X(u,p){ const ws=p?new W(u,p):new W(u); try{
        ws.addEventListener('message',(ev)=>{ try{ const raw=ev.data; let obj=null; if(typeof raw==='string'){ try{ obj=JSON.parse(raw);}catch(e){} }
          if(obj&&(obj.msg_type||obj.type)){ const app=window?.store?.appStore; const season=app?.currentSeason??app?.current_season??null; post({dir:'in',t:Date.now(),season,kind:(obj.msg_type||obj.type),data:obj}); } }catch(e){} });
        const _send=ws.send; ws.send=function(data){ try{ let obj=null; if(typeof data==='string'){try{obj=JSON.parse(data);}catch(e){} } if(obj&&(obj.msg_type||obj.type)){ const app=window?.store?.appStore; const season=app?.currentSeason??app?.current_season??null; post({dir:'out',t:Date.now(),season,kind:(obj.msg_type||obj.type),data:obj}); } }catch(e){} return _send.apply(this,arguments); };
        }catch(e){} return ws; }
        X.prototype = W.prototype; Object.keys(W).forEach(k=>{ try{ X[k]=W[k]; }catch(e){} }); window.WebSocket=X; };
      wrapWS();

      window.addEventListener('message',(ev)=>{
        const d=ev.data; if(!d||d.__BC_SHOP_V3__!==true) return;
        if(d.type==='STATE_REQUEST_V3'){
          try{
            const app = window?.store?.appStore;
            if(!app){ window.postMessage({__BC_SHOP_V3__:true, type:'STATE_RESPONSE_V3', payload_json:null, error:'AppStore not found'}, '*'); return; }
            const players = app.players || app.player_info || [];
            const nurseries = players.filter(p=> (p.role||'').includes('nursery')).map(p=>({
              uuid:p.uuid, name:p.name, ai_type:p.ai_type??null,
              fav_color:p.fav_color??p.fav_color_override??null,
              non_fav_color:p.non_fav_color??p.non_fav_color_override??null,
              relation_to_me:p.relation_to_me ?? null,
              default_prices:(p.default_prices||[]).map(x=>({gender:x.gender,color:x.color,buy_price:x.buy_price,sell_price:x.sell_price}))
            }));
            const shops = players.filter(p=> (p.role||'').includes('shop')).map(p=>({ uuid:p.uuid, name:p.name, ai_type:p.ai_type??null, relation_to_me:p.relation_to_me??null, default_prices:(p.default_prices||[]).map(x=>({gender:x.gender,color:x.color,buy_price:x.buy_price,sell_price:x.sell_price})) }));
            const showcaseSrc = (app.playerCats?.[app.me?.uuid] || app.showcase_prices || []);
            const showcase = (Array.isArray(showcaseSrc)?showcaseSrc:[]).map(r=>({ gender:r.gender, color:r.color, price:r.price ?? r.sell_price ?? null, count: (r.count ?? (r.contents?.length||0) ?? null), contents: Array.isArray(r.contents) ? r.contents.map(c=>({cat_id:c.cat_id})) : undefined }));
            const cityQuotaSrc = (app.sortedCityQuota||app.cityQuota||[]);
            const cityQuota = (Array.isArray(cityQuotaSrc)?cityQuotaSrc:[]).map(q=>({ gender:q.gender, color:q.color, buy_price:q.buy_price, sell_price:q.sell_price, quantity:q.quantity }));
            const season = app.currentSeason ?? app.current_season;
            const me = app.me?.uuid ?? null;
            const timers = { isRealTime: app.isRealTimeMode ?? false, seasonStart: app.seasonDurationStart ?? 0, seasonDurationSec: app.seasonDurationSec ?? 0, timerValueMs: (app.timerValue?.$ms) ?? null, sessionStartTime: app.sessionDurationStart ? app.sessionDurationStart.valueOf?.() ?? app.sessionDurationStart : null };
            const gameCosts = app._gameCosts || app.gameCosts || null;
            const credits = app.credits || null;
            const state = { season, balance: app.balance, me, showcase, cityQuota, nurseries, shops, timers, gameCosts, credits };
            try{ const json = JSON.stringify(state); window.postMessage({__BC_SHOP_V3__:true, type:'STATE_RESPONSE_V3', payload_json: json}, '*'); }
            catch(_){ window.postMessage({__BC_SHOP_V3__:true, type:'STATE_RESPONSE_V3', payload_json: null, error:'state_serialize_failed'}, '*'); }
          }catch(e){ window.postMessage({__BC_SHOP_V3__:true, type:'STATE_RESPONSE_V3', payload_json:null, error:String(e)}, '*'); }
        } else if(d.type==='AUTOTRADE_MESSAGES_V3'){
          try{
            const app = window?.store?.appStore; if(!app) { window.postMessage({__BC_SHOP_V3__:true, type:'AUTOTRADE_APPLIED', payload:false, error:'AppStore not found'}, '*'); return; }
            const messages = d.payload||[];
            try{ console.log('[BC V3] offers received:', messages.length); }catch(_e){}
            for(const m of messages){
              if(m.msg_type==='trading_request'){
                const lot = m.data||{};
                if(!lot.request_type || !(lot.seller||lot.buyer) || !Array.isArray(lot.contents)) continue;
                // Протокол: seller для buy, buyer для sell
                if(lot.request_type==='buy' && !lot.seller) continue;
                if(lot.request_type==='sell' && !lot.buyer) continue;
                try{ console.log('[BC V3] trading_request →', lot.request_type, 'partner:', (lot.seller||lot.buyer)||'—', 'contents:', lot.contents); }catch(_e){}
                try{ post({dir:'client', t:Date.now(), kind:'offer_preview', data:lot}); }catch(_e){}
                app.sendMessage('trading_request', lot);
                try{ post({dir:'client', t:Date.now(), kind:'offer_sent', data:lot}); }catch(_e){}
              }
            }
            window.postMessage({__BC_SHOP_V3__:true, type:'AUTOTRADE_APPLIED', payload:true}, '*');
          }catch(e){ window.postMessage({__BC_SHOP_V3__:true, type:'AUTOTRADE_APPLIED', payload:false, error:String(e)}, '*'); }
        }
      });
    }catch(e){}
  })();`;
  const s=document.createElement('script'); s.textContent=code; (document.head||document.documentElement).appendChild(s); s.remove();
}

function requestState(){
  return new Promise((resolve)=>{
    const h=(ev)=>{ const d = ev.data; if(!d||d.__BC_SHOP_V3__!==true||d.type!=='STATE_RESPONSE_V3') return; window.removeEventListener('message',h);
      try{ const json = d?.payload_json ?? null; resolve({ok: !!json, json, error:d.error}); }
      catch(e){ resolve({ok:false, json:null, error:'state_clone_failed'}); }
    };
    window.addEventListener('message',h); window.postMessage({__BC_SHOP_V3__:true, type:'STATE_REQUEST_V3'}, '*');
  });
}

inject();

browser.runtime.onMessage.addListener((msg)=>{
  if(msg?.type==='BC_SHOP_V3_PING') return Promise.resolve({ok:true});
  if(msg?.type==='BC_SHOP_V3_GET_STATE') return requestState();
  if(msg?.type==='BC_SHOP_V3_GET_STATE_MIN'){
    try{
      const app = window?.store?.appStore;
      if(!app) return Promise.resolve({ok:false, json:null, error:'AppStore not found'});
      const season = app.currentSeason ?? app.current_season ?? null;
      const out = { season, balance: app.balance ?? null };
      return Promise.resolve({ok:true, json: JSON.stringify(out)});
    }catch(e){ return Promise.resolve({ok:false, json:null, error:String(e)}); }
  }
  if(msg?.type==='BC_SHOP_V3_GET_LOGS'){
    try{ const json = JSON.stringify(__bc_shop_logs.slice(-1000)); return Promise.resolve({ok:true, json}); }
    catch(e){ return Promise.resolve({ok:false, json:null, error:'logs_serialize_failed'}); }
  }
  if(msg?.type==='BC_SHOP_V3_CLEAR_LOGS'){ __bc_shop_logs.length=0; return Promise.resolve({ok:true}); }
  if(msg?.type==='AUTOTRADE_MESSAGES_V3'){
    try{
      return new Promise((resolve)=>{
        const h=(ev)=>{
          const d=ev.data; if(!d||d.__BC_SHOP_V3__!==true||d.type!=='AUTOTRADE_APPLIED') return;
          window.removeEventListener('message', h);
          if(d.payload===true) resolve({ok:true}); else resolve({ok:false, error: d.error||'apply_failed'});
        };
        window.addEventListener('message', h);
        // re-post into page context where injected handler will call app.sendMessage
        window.postMessage({ __BC_SHOP_V3__: true, type: 'AUTOTRADE_MESSAGES_V3', payload: msg.payload||[] }, '*');
        // fallback timeout
        setTimeout(()=>{ try{ window.removeEventListener('message', h);}catch(_){} resolve({ok:false, error:'timeout'}); }, 3000);
      });
    }catch(e){ return Promise.resolve({ok:false, error:String(e)}); }
  }
});
