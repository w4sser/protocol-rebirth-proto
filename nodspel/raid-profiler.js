const percentile=(v,p)=>{const a=[...v].sort((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.ceil(a.length*p)-1)]:null;};
export function summarizeFrames(samples){const times=samples.map(s=>s.ms),calls=samples.map(s=>s.calls),total=times.reduce((a,b)=>a+b,0);
  return {frames:samples.length,fps:total?samples.length*1000/total:null,frameMs:{median:percentile(times,.5),p95:percentile(times,.95)},drawCalls:{median:percentile(calls,.5),p95:percentile(calls,.95),max:calls.length?Math.max(...calls):null}};}
export function createRaidProfiler(){let capture=null;return {
  get active(){return capture!==null;},
  start({durationMs=15000,warmupMs=2000,metadata={}}={}){if(capture)return Promise.reject(Error('Capture already running'));
    durationMs=Math.max(1000,Math.min(60000,durationMs));warmupMs=Math.max(0,Math.min(10000,warmupMs));
    return new Promise(resolve=>{const c={start:performance.now()+warmupMs,last:null,samples:[]};capture=c;
      setTimeout(()=>{capture=null;resolve({...metadata,durationMs,warmupMs,...summarizeFrames(c.samples)});},durationMs+warmupMs);});},
  frame(now,calls){const c=capture;if(!c||now<c.start)return;if(c.last!==null)c.samples.push({ms:now-c.last,calls});c.last=now;},
};}
