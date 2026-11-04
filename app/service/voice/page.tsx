"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import Link from "next/link";
import { Mic,MicOff,PhoneOff,Volume2 } from "lucide-react";
import AppNav from "@/app/components/AppNav";
import { LanguageSwitch,useLanguage } from "@/app/i18n";
import { ownerWorkspace } from "@/lib/service/company";
import styles from "../service.module.css";
type Phase="idle"|"connecting"|"connected"|"listening"|"speaking";
type Connection={pc:RTCPeerConnection;stream:MediaStream;dc:RTCDataChannel;token?:string;accessToken:string;timer?:ReturnType<typeof setTimeout>;timeout?:ReturnType<typeof setTimeout>};
export default function VoiceTest(){
 const{lang}=useLanguage();const ar=lang==="ar";const c=(en:string,arabic:string)=>ar?arabic:en;
 const[phase,setPhase]=useState<Phase>("idle");const[notice,setNotice]=useState("");const[muted,setMuted]=useState(false);const[captions,setCaptions]=useState<string[]>([]);
 const audio=useRef<HTMLAudioElement>(null);const connection=useRef<Connection|null>(null);const controller=useRef<AbortController|null>(null);const generation=useRef(0);const mounted=useRef(true);
 const stop=useCallback(()=>{
  generation.current++;controller.current?.abort();controller.current=null;
  const current=connection.current;connection.current=null;
  if(current){clearTimeout(current.timer);clearTimeout(current.timeout);current.dc.onclose=null;current.pc.onconnectionstatechange=null;current.stream.getTracks().forEach(track=>track.stop());current.dc.close();current.pc.close();
   if(current.token)void fetch("/api/service/voice",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${current.accessToken}`},body:JSON.stringify({callToken:current.token}),keepalive:true}).catch(()=>{});
  }
  if(audio.current){audio.current.pause();audio.current.srcObject=null;}
  if(mounted.current){setPhase("idle");setMuted(false);}
 },[]);
 useEffect(()=>{mounted.current=true;const onPageHide=()=>stop();window.addEventListener("pagehide",onPageHide);return()=>{mounted.current=false;window.removeEventListener("pagehide",onPageHide);stop();};},[stop]);
 async function start(){
  if(phase!=="idle")return;setNotice("");setCaptions([]);setPhase("connecting");const id=++generation.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined")throw new Error("Use Safari or Chrome over HTTPS / افتح الصفحة في سفاري أو كروم عبر HTTPS");
   const{client,company,role}=await ownerWorkspace();if(id!==generation.current)return;if(role!=="owner")throw new Error("Sign in as company owner / سجّل الدخول كمالك للشركة");
   const{data:{session}}=await client.auth.getSession();if(!session)throw new Error("Sign in first / سجّل دخولك أولًا");
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(id!==generation.current){stream.getTracks().forEach(track=>track.stop());return;}
   const pc=new RTCPeerConnection();const dc=pc.createDataChannel("oai-events");const current:Connection={pc,dc,stream,accessToken:session.access_token};connection.current=current;
   current.timeout=setTimeout(()=>{if(id===generation.current){stop();setNotice("Voice connection timed out / انتهت مهلة الاتصال الصوتي");}},30000);
   pc.ontrack=event=>{if(audio.current){audio.current.srcObject=event.streams[0]||new MediaStream([event.track]);void audio.current.play().catch(()=>{if(mounted.current)setNotice("Tap play on the audio control to hear the assistant / اضغط تشغيل الصوت لسماع المساعد");});}};
   stream.getAudioTracks().forEach(track=>pc.addTrack(track,stream));
   dc.onopen=()=>{if(id!==generation.current)return;clearTimeout(current.timeout);setPhase("connected");current.timer=setTimeout(()=>{stop();setNotice("Two-minute voice test ended / انتهت التجربة الصوتية بعد دقيقتين");},120000);dc.send(JSON.stringify({type:"response.create"}));};
   dc.onclose=()=>{if(id===generation.current){stop();setNotice("Voice session ended / انتهت الجلسة الصوتية");}};
   dc.onmessage=event=>{if(id!==generation.current)return;try{const message=JSON.parse(event.data);if(message.type==="input_audio_buffer.speech_started")setPhase("listening");if(message.type==="response.output_audio.delta"||message.type==="output_audio_buffer.started")setPhase("speaking");if(message.type==="response.done"||message.type==="output_audio_buffer.stopped")setPhase("connected");if(message.type==="response.output_audio_transcript.done"&&typeof message.transcript==="string")setCaptions(old=>[...old.slice(-9),message.transcript.slice(0,4000)]);if(message.type==="error"){stop();setNotice("Voice service reported an error. Retry or check AI account access / حدث خطأ بخدمة الصوت، حاول مجددًا أو تحقّق من حساب AI");}}catch{}};
   pc.onconnectionstatechange=()=>{if(id!==generation.current)return;if(pc.connectionState==="failed"||pc.connectionState==="closed"){stop();setNotice("Connection lost / انقطع الاتصال");}};
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   const abort=new AbortController();controller.current=abort;
   const result=await fetch("/api/service/voice",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({companyId:company.id,sdp:pc.localDescription?.sdp||offer.sdp}),signal:abort.signal});
   const data=await result.json();if(id!==generation.current){if(data.callToken)void fetch("/api/service/voice",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({callToken:data.callToken}),keepalive:true}).catch(()=>{});return;}
   if(!result.ok)throw new Error(data.error||"Voice connection failed");current.token=data.callToken;await pc.setRemoteDescription({type:"answer",sdp:data.sdp});
  }catch(error){if(id!==generation.current)return;stop();if(mounted.current)setNotice(error instanceof DOMException&&error.name==="NotAllowedError"?"Microphone permission is required. Enable it in your browser settings / يلزم السماح باستخدام المايك من إعدادات المتصفح":error instanceof Error?error.message:"Voice test failed / تعذّرت التجربة");}
 }
 function toggleMute(){const current=connection.current;if(!current)return;const next=!muted;current.stream.getAudioTracks().forEach(track=>{track.enabled=!next;});setMuted(next);}
 const phaseText=phase==="connecting"?c("Connecting…","جارٍ الاتصال…"):phase==="listening"?c("Hearing you","أسمعك"):phase==="speaking"?c("Assistant speaking","المساعد يرد"):phase==="connected"?c("Connected — speak now","متصل — احكي الآن"):c("Ready to try","جاهز للتجربة");
 return <main className="appshell"><AppNav/><div className="appbody"><div className={`module ${styles.center}`} dir={ar?"rtl":"ltr"} data-no-translate><header><Link href="/service">← {c("Service center","مركز الخدمة")}</Link><LanguageSwitch/></header><section><div className={styles.heading}><div><small>NAYROQ · VOICE LAB</small><h1>{c("Talk to your AI assistant","احكي مع مساعدك الذكي")}</h1><p>{c("A real voice conversation from your browser, using saved company information. Start the test and allow the microphone.","محادثة صوتية من المتصفح باستخدام معلومات شركتك المحفوظة. ابدأ التجربة واسمح باستخدام المايك.")}</p></div><Mic size={42}/></div><div className={styles.configgrid}><article className={`panel ${styles.editor}`}><h2>{c("Browser voice test","تجربة صوتية من المتصفح")}</h2><p role="status" aria-live="polite">{phaseText}</p>{notice&&<p role="alert">{notice}</p>}<div className={styles.tabs}>{phase==="idle"?<button type="button" onClick={()=>void start()}><Mic size={18}/> {c("Start voice test","ابدأ التجربة الصوتية")}</button>:<><button type="button" onClick={stop}><PhoneOff size={18}/> {c("End test","إنهاء التجربة")}</button><button type="button" disabled={phase==="connecting"} aria-pressed={muted} onClick={toggleMute}>{muted?<MicOff size={18}/>:<Mic size={18}/>} {muted?c("Unmute","تشغيل المايك"):c("Mute","كتم المايك")}</button></>}</div><label><Volume2 size={18}/> {c("Assistant audio","صوت المساعد")}<audio ref={audio} autoPlay controls/></label><p>{c("This is an AI voice. The test ends in this browser after two minutes and uses your OpenAI balance. Your microphone audio is sent to OpenAI during the test. This app does not record or save audio or captions.","هذا صوت مولّد بالذكاء الاصطناعي. تنتهي التجربة في المتصفح بعد دقيقتين وتستهلك من رصيد OpenAI. يُرسل صوت المايك إلى OpenAI أثناء التجربة. التطبيق لا يسجّل الصوت ولا يحفظه أو يحفظ النص.")}</p><small>{c("The two-minute timer is a browser control, not a server billing cap. Close the test when finished.","مؤقّت الدقيقتين يعمل في المتصفح، وليس سقفًا للفوترة على الخادم. أنهِ التجربة عند الانتهاء.")}</small></article><aside className={styles.setup}><article className="panel"><h2>{c("Try asking","جرّب تسأل")}</h2><ul><li>{c("What services do you offer?","شو الخدمات اللي بتقدموها؟")}</li><li>{c("What are your working hours?","شو أوقات الدوام؟")}</li><li>{c("How much does this service cost?","كم سعر الخدمة؟")}</li></ul><p>{c("For accurate answers, add company knowledge and save assistant instructions first.","لإجابات دقيقة، أضف معلومات الشركة واحفظ تعليمات المساعد أولًا.")}</p><Link href="/knowledge">{c("Company knowledge","معلومات الشركة")} ↗</Link><Link href="/service/configuration">{c("Assistant settings","إعدادات المساعد")} ↗</Link><p>{c("This browser test does not activate calls on your Ooredoo number or execute bookings or transfers.","تجربة المتصفح لا تفعّل المكالمات على رقم أوريدو ولا تنفّذ حجوزات أو تحويلات.")}</p></article><article className="panel"><h2>{c("Assistant captions","نص ردود المساعد")}</h2>{captions.length?captions.map((text,index)=><p key={index}>{text}</p>):<p>{c("Responses appear here during the test.","تظهر الردود هنا أثناء التجربة.")}</p>}</article></aside></div></section></div></div></main>;
}
