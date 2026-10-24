// Authenticated Dream Protocol line call events. No client agents.
const ASSISTANT_ID='2dc04098-ce55-4aa9-a98b-f5d5d87484d4';
const PHONE_ID='8b939452-5fda-4d5c-9c4f-231bcf1cafbb';
const limited=(x,n=2000)=>typeof x==='string'?x.slice(0,n).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,''): '';
const safeDate=x=>(typeof x==='string'&&!Number.isNaN(Date.parse(x)))?new Date(x).toISOString():null;
function categorize(summary) {
  const s=summary.toLowerCase();
  const tech=/\b(network|server|email|internet|outage|system|website|login|phone|vapi|voip|dns|cloud|software|service)\b/.test(s);
  const severe=/\b(critical|emergency|production down|entire office down|site down|business down|severe outage|all users affected|cannot operate)\b/.test(s);
  const support=tech&&/\b(broken|not working|can't|cannot|down|issue|problem|help|support|failure|error|outage)\b/.test(s);
  const sales=/\b(quote|pricing|how much|trial|demo|purchase|interested|new client|our business|sign up|consultation|get started|looking for|buy|subscription)\b/.test(s);
  return {category:support?'support':sales?'sales':'general',urgent:support&&severe};
}
async function authenticated(req,expected) {
  if(typeof expected!=='string'||expected.length<28)return false;
  const got=req.headers.get('Authorization')||'';
  if(!got.startsWith('Bearer '))return false;
  const a=new TextEncoder().encode(got.slice(7));
  const b=new TextEncoder().encode(expected);
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}
function number(s) {
  const x=limited(s,35).replace(/[^\d+]/g,'');
  return /^\+?[0-9]{7,16}$/.test(x)?x:'';
}
function extract(message) {
  const call=message.call||{};
  const rawAnalysis=message.analysis||call.analysis||{};
  const summary=limited(rawAnalysis.summary||'',2400).trim();
  const cls=categorize(summary);
  const start=safeDate(message.startedAt||call.startedAt);
  const end=safeDate(message.endedAt||call.endedAt);
  const duration=start&&end?Math.max(0,Math.round((Date.parse(end)-Date.parse(start))/1000)):null;
  return {
    id:limited(call.id,100),assistantId:limited(call.assistantId,100),
    phoneNumberId:limited(call.phoneNumberId,100),
    startedAt:start,endedAt:end,receivedAt:new Date().toISOString(),
    caller:number(call.customer?.number),
    summary:summary||'Summary not provided by Vapi. Review the call in the Vapi dashboard.',
    priority:cls.urgent?'urgent':'normal',category:cls.category,
    endedReason:limited(message.endedReason||call.endedReason,140),duration
  };
}
export async function handleVapiEndCall(request,env,ctx){
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  if(!(await authenticated(request,env.VAPI_WEBHOOK_TOKEN)))return new Response('Unauthorized',{status:401});
  if(Number(request.headers.get('content-length')||0)>180000)return new Response('Payload too large',{status:413});
  let body;
  try{const raw=await request.text();if(raw.length>180000)return new Response('Payload too large',{status:413});body=JSON.parse(raw);}
  catch{return new Response('Invalid JSON',{status:400});}
  const msg=body?.message||body;
  if(msg?.type!=='end-of-call-report')return new Response(JSON.stringify({ok:true,ignored:true}),{headers:{'Content-Type':'application/json'}});
  const record=extract(msg);
  if(record.assistantId!==ASSISTANT_ID||record.phoneNumberId!==PHONE_ID)return new Response(JSON.stringify({ok:true,ignored:true}),{headers:{'Content-Type':'application/json'}});
  if(!/^[0-9a-f-]{36}$/i.test(record.id))return new Response('Invalid call ID',{status:400});
  if(!env.DB)return new Response('Storage unavailable',{status:503});
  const sql="INSERT INTO dream_calls (call_id,received_at,started_at,ended_at,caller_number,category,priority,summary,duration_seconds,ended_reason,email_status) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(call_id) DO UPDATE SET summary=CASE WHEN excluded.summary LIKE 'Summary not provided%' THEN dream_calls.summary ELSE excluded.summary END, ended_reason=excluded.ended_reason, updated_at=excluded.received_at";
  const prev=await env.DB.prepare('SELECT call_id FROM dream_calls WHERE call_id=?').bind(record.id).first();
  if(!prev) {
    await env.DB.prepare(sql).bind(record.id,record.receivedAt,record.startedAt,record.endedAt,record.caller,record.category,record.priority,record.summary,record.duration,record.endedReason,'pending').run();
    if(env.CALL_MAIL) {
      const work=notifyCall(record,env).catch(()=>{});
      if(ctx?.waitUntil)ctx.waitUntil(work);else await work;
    }
  }
  return new Response(JSON.stringify({ok:true,duplicate:Boolean(prev)}),{headers:{'Content-Type':'application/json'}});
}
async function notifyCall(call,env) {
  if(!env.CALL_MAIL||!env.NOTIFY_EMAIL||!env.NOTIFY_FROM)return;
  const subject=(call.priority==='urgent'?'[URGENT] ':'')+'Dream Protocol call: '+call.category;
  const lines=['Dream Protocol phone line: (628) 251-3616','Call type: '+call.category.toUpperCase(),
    'Priority: '+call.priority.toUpperCase(),'Caller: '+(call.caller||'Not provided'),
    'Time: '+(call.startedAt||call.receivedAt),
    'Duration: '+(call.duration===null?'Unknown':call.duration+' seconds'),
    'Summary:',call.summary,
    'Private command center: https://command.dreamprotocol.ai/'];
  try {
    await env.CALL_MAIL.send({from:env.NOTIFY_FROM,to:env.NOTIFY_EMAIL,subject,text:lines.join('\n')});
    await env.DB.prepare("UPDATE dream_calls SET email_status='sent', updated_at=? WHERE call_id=?").bind(new Date().toISOString(),call.id).run();
  } catch {
    await env.DB.prepare("UPDATE dream_calls SET email_status='error', updated_at=? WHERE call_id=?").bind(new Date().toISOString(),call.id).run();
  }
}
export async function callHistory(env,days) {
  const from=new Date(Date.now()-Math.min(Math.max(Number(days)||7,1),30)*86400000).toISOString();
  return (await env.DB.prepare('SELECT call_id,received_at,started_at,caller_number,category,priority,summary,duration_seconds,ended_reason,email_status FROM dream_calls WHERE received_at>=? ORDER BY received_at DESC LIMIT 70').bind(from).all()).results||[];
}
export async function pruneCallHistory(env) {
  await env.DB.prepare('DELETE FROM dream_calls WHERE received_at < ?').bind(new Date(Date.now()-30*86400000).toISOString()).run();
}
