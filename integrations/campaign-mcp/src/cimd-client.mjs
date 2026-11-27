export async function neoCimdClientAllowed(clients, clientId, redirectUri = null, fetcher = fetch) {
  if (clients.has(clientId)) return redirectUri === null || clients.get(clientId).includes(redirectUri);
  const nativeId = "https://chatgpt.com/oauth/codex/client.json";
  const webId = "https://chatgpt.com/oauth/client.json";
  if (clientId !== nativeId && clientId !== webId) return false;
  try {
    let target = null;
    if (redirectUri !== null) {
      target = new URL(redirectUri);
      if (target.username || target.password || target.hash || target.search) return false;
      if (clientId === nativeId) {
        if (target.protocol !== "http:" || !["localhost","127.0.0.1"].includes(target.hostname) || !target.port || target.pathname !== "/callback" || target.href !== redirectUri) return false;
      } else if (target.href !== "https://chatgpt.com/connector_platform_oauth_redirect" || redirectUri !== target.href) return false;
    }
    const res = await fetcher(clientId, {method:"GET",redirect:"manual",headers:{Accept:"application/json"},signal:AbortSignal.timeout(5000)});
    if (!res.ok || !/^application\/json(?:\s*;|$)/i.test(res.headers.get("content-type") || "")) return false;
    if (Number(res.headers.get("content-length") || 0) > 16384 || !res.body) return false;
    const reader = res.body.getReader(); let length = 0; let raw = ""; const decoder = new TextDecoder("utf-8",{fatal:true});
    for (;;) { const {value,done} = await reader.read(); if (done) break; length += value.byteLength; if (length > 16384) { await reader.cancel(); return false; } raw += decoder.decode(value,{stream:true}); }
    const doc = JSON.parse(raw + decoder.decode());
    if (doc.client_id !== clientId || !Array.isArray(doc.redirect_uris) || !Array.isArray(doc.grant_types) || !doc.grant_types.includes("authorization_code") || !Array.isArray(doc.response_types) || !doc.response_types.includes("code")) return false;
    const methods = doc.token_endpoint_auth_methods_supported ?? [doc.token_endpoint_auth_method];
    if (!Array.isArray(methods) || !methods.includes("none")) return false;
    if (clientId === nativeId && doc.application_type !== "native") return false;
    if (target === null) return doc.grant_types.includes("refresh_token");
    if (clientId === nativeId) { const base = "http://" + target.hostname + "/callback"; return doc.redirect_uris.includes(base); }
    return doc.redirect_uris.includes(redirectUri);
  } catch { return false; }
}
