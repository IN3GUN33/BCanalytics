// Upcoming credit payments estimation and cash buffer policy

function sumPayment(body){
  const b = body||{};
  return (b.body_payment||0) + (b.percent_payment||0);
}

export function upcomingPayment({credits, timers}){
  const info = credits?.credits_info||[];
  if(!info.length) return { payment: 0, timestamp: null };
  const now = (timers?.isRealTime && timers?.timerValueMs!=null && timers?.sessionStartTime!=null)
    ? Math.floor(timers.sessionStartTime + (timers.timerValueMs/1000))
    : null;

  if(now==null){
    // turn-based approximation: sum next-scheduled bodies per credit (first non-zero)
    let total = 0;
    info.forEach(cr=>{
      const bodies = (cr.credit_bodies||[]).filter(b=>sumPayment(b)!==0);
      if(bodies.length){
        const next = bodies[0];
        total += sumPayment(next);
      }
    });
    return { payment: total, timestamp: null };
  }

  // real-time: find nearest time across all credits
  let nearestTime = null;
  info.forEach(cr=>{
    (cr.credit_bodies||[]).forEach(b=>{
      if(sumPayment(b)===0) return;
      if(b.time==null) return;
      if(b.time >= now){
        if(nearestTime==null || b.time < nearestTime) nearestTime = b.time;
      }
    });
  });
  if(nearestTime==null) return { payment: 0, timestamp: null };
  let totalAtNearest = 0;
  info.forEach(cr=>{
    (cr.credit_bodies||[]).forEach(b=>{
      if(sumPayment(b)===0) return;
      if(b.time === nearestTime) totalAtNearest += sumPayment(b);
    });
  });
  return { payment: totalAtNearest, timestamp: nearestTime };
}

// Compute a conservative cash reserve we should keep to avoid cash gaps.
// risk = { reservePct: 0.1, reserveAbs: 20 }
export function cashReserve({balance=0, credits, timers, gameCosts, risk}){
  const r = risk||{};
  const pct = Math.max(0, Math.min(0.9, r.reservePct ?? 0.1));
  const abs = Math.max(0, r.reserveAbs ?? 20);
  const up = upcomingPayment({credits, timers}).payment || 0;
  const household = (gameCosts?.household||0);
  // Keep: upcoming credit payment + household for safety + user-configured reserves
  const base = up + Math.ceil(household*0.5);
  const byPct = Math.floor(balance * pct);
  return Math.max(abs, base, byPct);
}
