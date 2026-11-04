import { createHmac, timingSafeEqual } from "node:crypto";
export function signVoiceCall(userId: string, callId: string, secret: string, now = Date.now()) {
 const payload=Buffer.from(JSON.stringify({scope:"voice-hangup",userId,callId,expires:now+3600000})).toString("base64url");
 return `${payload}.${createHmac("sha256",secret).update(payload).digest("base64url")}`;
}
export function verifyVoiceCall(token: string, userId: string, secret: string, now = Date.now()): string | null {
 try {
  if(token.length>2000)return null;
  const [payload,signature,...extra]=token.split(".");if(!payload||!signature||extra.length)return null;
  const expected=createHmac("sha256",secret).update(payload).digest();const actual=Buffer.from(signature,"base64url");
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  const data=JSON.parse(Buffer.from(payload,"base64url").toString());
  return data.scope==="voice-hangup"&&data.userId===userId&&typeof data.expires==="number"&&data.expires>now&&typeof data.callId==="string"&&/^[A-Za-z0-9_-]{8,200}$/.test(data.callId)?data.callId:null;
 }catch{return null;}
}
