// Dream Protocol: Vapi end-of-call reports to Cloudflare D1 + owner notifications.
// No client assistants, recordings, credentials, or full transcripts are collected.
const clip=(x,n=1400)=>typeof x==="string"?x.replace(/[\u0000-\u001f\u007f]/g," ").slice(0,n).trim():"";
const resp=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const validId=x=>typeof x==="string"&&/^[a-z0-9-]{20,100}$/i.test(x);
const rawPhone=x=>typeof x==="string"&&/^\+?[0-9() \-]{8,24}$/.test(x)?clip(x,24):"";
async function okSecret(actual,secret){
 if(!actual||!secret||actual.length>300||secret.length>300)return false;
 const hash=async v=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
 const [a,b]=await Promise.all([hash(actual),hash(secret)]);
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
function interpret(m){
 const call=m.call||{},analysis=m.analysis||call.analysis||{},artifact=m.artifact||call.artifact||{};
 const transcript=clip(artifact.transcript,10000),summary=clip(analysis.summary,1600);
 const hay=(summary+" "+transcript).toLowerCase();
 const urgent=/ransomware|security breach|server down|network down|critical outage|all systems down|emergency support|urgent technical issue/.test(hay);
 const support=urgent||/tech support|technical support|existing customer|support request|network issue|system outage/.test(hay);
 const sales=/pricing|price quote|new customer|new client|receptionist|demo|ai automation|interested in your service|consultation|proposal/.test(hay);
 const category=urgent?"urgent_support":support?"support":sales?"sales":"general";
 const duration=call.startedAt&&call.endedAt?Math.max(0,Math.min(7200,Math.round((Date.parse(call.endedAt)-Date.parse(call.startedAt))/1000)||0)):0;
 return {
  id:clip(call.id,100),assistantId:call.assistantId||m.assistant?.id||"",numberId:call.phoneNumberId||call.phoneNumber?.id||"",
  createdAt:new Date().toISOString(),caller:rawPhone(call.customer?.number||m.customer?.number),
  category,urgent:Number(urgent),summary:summary||"No summary generated. Review this call in Vapi.",
  duration,endedReason:clip(m.endedReason||call.endedReason,100)
 };
}
async function sendEmail(env,row){
 if(!env.EMAIL||!env.OWNER_EMAIL)return {ok:false,reason:"email binding or destination missing"};
 const subject="Dream Protocol / "+row.category.toUpperCase().replace("_"," ")+" / "+(row.caller||"Caller unknown");
 const body=[
  "Dream Protocol AI call report", "Type: "+row.category,
  "Caller: "+(row.caller||"Not available"),"Time: "+row.created_at,
  "Duration: "+row.duration+" seconds",
  "Call ID: "+row.call_id,"End reason: "+row.ended_reason,"",
  "Summary:",row.summary,"",
  "If this requires action, please follow up directly. Automated alerts do not guarantee a response."
 ].join("\n");
 try{
  await env.EMAIL.send({from:"alerts@dreamprotocol.ai",to:env.OWNER_EMAIL,subject,text:body});
  return {ok:true};
 }catch(e){return {ok:false,reason:clip(String(e?.message||e),160)}}
}
async function sendSMS(env,row){
 if(!env.SMS_ACCOUNT_SID||!env.SMS_AUTH_TOKEN||!env.SMS_FROM||!env.OWNER_CELL)return {ok:false,reason:"SMS account not connected"};
 const label=row.category==="urgent_support"?"URGENT SUPPORT":row.category==="sales"?"SALES":"SUPPORT";
 const body=new URLSearchParams({To:env.OWNER_CELL,From:env.SMS_FROM,Body:"Dream Protocol "+label+" call from "+(row.caller||"unknown")+". Check your email for the summary."});
 try{
  const r=await fetch("https://api.twilio.com/2010-04-01/Accounts/"+encodeURIComponent(env.SMS_ACCOUNT_SID)+"/Messages.json",{
   method:"POST",headers:{"authorization":"Basic "+btoa(env.SMS_ACCOUNT_SID+":"+env.SMS_AUTH_TOKEN),"content-type":"application/x-www-form-urlencoded"},body:body.toString()
  });
  if(!r.ok)return {ok:false,reason:"SMS HTTP "+r.status};
  return {ok:true};
 }catch(e){return {ok:false,reason:clip(String(e?.message||e),160)}}
}
async function deliver(db,env,id,kind){
 const status=kind+"_status",attempts=kind+"_attempts";
 const locked=await db.prepare("UPDATE call_reports SET "+status+"='sending',"+attempts+"="+attempts+"+1 WHERE call_id=? AND "+status+" IN ('pending','retry') AND "+attempts+"<4 RETURNING call_id").bind(id).first();
 if(!locked)return;
 const row=await db.prepare("SELECT * FROM call_reports WHERE call_id=?").bind(id).first();
 const out=kind==="email"?await sendEmail(env,row):await sendSMS(env,row);
 await db.prepare("UPDATE call_reports SET "+status+"=?,last_error=? WHERE call_id=?").bind(out.ok?"sent":"retry",out.ok?"":out.reason,id).run();
}
async function flush(db,env,id){
 const row=await db.prepare("SELECT * FROM call_reports WHERE call_id=?").bind(id).first();
 if(!row)return;
 if(env.EMAIL&&env.OWNER_EMAIL)await deliver(db,env,id,"email");
 if((row.category==="sales"||row.category==="support"||row.category==="urgent_support")&&env.SMS_ACCOUNT_SID&&env.SMS_AUTH_TOKEN&&env.SMS_FROM&&env.OWNER_CELL)await deliver(db,env,id,"sms");
}
async function webhook(req,env,ctx){
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const auth=req.headers.get("x-vapi-secret")||req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
 if(!await okSecret(auth,env.VAPI_WEBHOOK_SECRET))return new Response("Forbidden",{status:403});
 if(!env.DB)return resp({error:"DB unavailable"},503);
 if(Number(req.headers.get("content-length")||0)>300000)return resp({error:"too large"},413);
 let raw;try{raw=await req.text();if(raw.length>300000)return resp({error:"too large"},413)}catch{return resp({error:"invalid input"},400)}
 let payload;try{payload=JSON.parse(raw)}catch{return resp({error:"invalid JSON"},400)}
 const m=payload?.message;
 if(!m||typeof m!=="object")return resp({error:"invalid message"},400);
 // Other message types receive a harmless response.
 if(m.type!=="end-of-call-report")return resp({ok:true,ignored:true});
 const event=interpret(m);
 if(!validId(event.id))return resp({error:"invalid call"},400);
 if(event.assistantId!==env.VAPI_ASSISTANT_ID)return resp({ok:true,ignored:true});
 if(event.numberId&&event.numberId!==env.VAPI_PHONE_ID)return resp({ok:true,ignored:true});
 await env.DB.prepare("INSERT OR IGNORE INTO call_reports (call_id,created_at,caller,category,urgent,summary,duration,ended_reason,email_status,sms_status) VALUES (?,?,?,?,?,?,?,?,?,?)")
 .bind(event.id,event.createdAt,event.caller,event.category,event.urgent,event.summary,event.duration,event.endedReason,"pending","pending").run();
 ctx.waitUntil(flush(env.DB,env,event.id));
 return resp({ok:true});
}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.hostname!==(env.CALLS_HOST||"calls.dreamprotocol.ai"))return new Response("Not found",{status:404});
  if(url.pathname==="/health"&&request.method==="GET")return resp({up:Boolean(env.DB&&env.VAPI_WEBHOOK_SECRET),email:Boolean(env.EMAIL&&env.OWNER_EMAIL),sms:Boolean(env.SMS_ACCOUNT_SID&&env.SMS_AUTH_TOKEN&&env.SMS_FROM&&env.OWNER_CELL)});
  if(url.pathname==="/vapi")return webhook(request,env,ctx);
  return new Response("Not found",{status:404});
 },
 async scheduled(event,env){
  if(!env.DB)return;
  const {results=[]}=await env.DB.prepare("SELECT call_id FROM call_reports WHERE (email_status IN ('pending','retry') AND email_attempts<4) OR (sms_status IN ('pending','retry') AND sms_attempts<4) LIMIT 25").all();
  for(const row of results)await flush(env.DB,env,row.call_id);
  await env.DB.prepare("DELETE FROM call_reports WHERE created_at < ?").bind(new Date(Date.now()-30*86400000).toISOString()).run();
 }
};