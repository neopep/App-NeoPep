import {createClient} from "npm:@supabase/supabase-js@2.80.0";

const staging = "https://qnuluspqfazdppciermw.supabase.co";
const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), {
  status, headers: {"Content-Type":"application/json", "Cache-Control":"no-store"}
});
Deno.serve(async (req) => {
  if (Deno.env.get("SUPABASE_URL") !== staging) return respond(404, null);
  if (req.method !== "POST") return respond(405, null);
  const authorization = req.headers.get("Authorization") || "";
  if (!/^Bearer [A-Za-z0-9_.-]{20,4096}$/.test(authorization)) return respond(401, null);
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !serviceKey) return respond(503, null);
  if (req.headers.get("Content-Length") && Number(req.headers.get("Content-Length")) > 4096) return respond(413, null);
  try {
    const reader=req.body?.getReader();
    if(!reader) return respond(400,null);
    let size=0, raw="";
    const decoder=new TextDecoder();
    while(true){
      const part=await reader.read();
      if(part.done)break;
      size+=part.value.length;
      if(size>4096){await reader.cancel();return respond(413,null);}
      raw+=decoder.decode(part.value,{stream:true});
    }
    const body=JSON.parse(raw+decoder.decode());
    if (!["check","download","report"].includes(body?.action)) return respond(400, null);
    const client = createClient(staging, apiKey, {global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {error: identityError} = await client.auth.getUser(authorization.slice(7));
    if (identityError) return respond(401, null);
    const {data,error} = await client.rpc("neo_connect_update", {
      p_action:body.action,p_device:body.device,p_secret:body.secret,p_version:body.version??null,p_outcome:body.outcome??null
    });
    if (error) return respond(error.code==="42501"?403:400,null);
    if (!data || body.action==="report") return respond(200,data);
    const {path,...manifest}=data;
    if (body.action==="check") return respond(200,manifest);
    const storage=createClient(staging,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}).storage;
    const signed=await storage.from("neo-connect-releases").createSignedUrl(path,90);
    if (signed.error) return respond(503,null);
    return respond(200,{...manifest,url:signed.data.signedUrl});
  } catch { return respond(400,null); }
});
