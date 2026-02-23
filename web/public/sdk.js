"use strict";var CashTap=(()=>{var y=Object.defineProperty;var f=Object.getOwnPropertyDescriptor;var h=Object.getOwnPropertyNames;var g=Object.prototype.hasOwnProperty;var x=(e,r)=>{for(var o in r)y(e,o,{get:r[o],enumerable:!0})},b=(e,r,o,a)=>{if(r&&typeof r=="object"||typeof r=="function")for(let t of h(r))!g.call(e,t)&&t!==o&&y(e,t,{get:()=>r[t],enumerable:!(a=f(r,t))||a.enumerable});return e};var w=e=>b(y({},"__esModule",{value:!0}),e);var k={};x(k,{button:()=>u,closeModal:()=>c,createCheckout:()=>d,default:()=>S,openModal:()=>l});var C="https://cashtap.app/api/v1";async function d(e,r,o){let a=o.apiUrl||C,t=await fetch(`${a}/checkout/sessions`,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":e},body:JSON.stringify({amount:r,currency:"USD",memo:o.memo,success_url:o.successUrl,cancel_url:o.cancelUrl})});if(!t.ok){let n=await t.json().catch(()=>({error:"Request failed"}));throw new Error(n.error||`HTTP ${t.status}`)}return t.json()}var m=null;function l(e,r){c();let o=document.createElement("div");o.id="cashtap-overlay",o.style.cssText=`
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 999999;
    display: flex; align-items: center; justify-content: center;
    animation: cashtap-fade-in 0.2s ease;
  `;let a=document.createElement("div");a.style.cssText=`
    background: white; border-radius: 16px; overflow: hidden;
    width: 420px; max-width: 95vw; height: 680px; max-height: 90vh;
    box-shadow: 0 25px 50px rgba(0,0,0,0.25);
    position: relative;
  `;let t=document.createElement("button");t.innerHTML="&times;",t.style.cssText=`
    position: absolute; top: 8px; right: 12px; z-index: 10;
    background: none; border: none; font-size: 24px;
    cursor: pointer; color: #666; line-height: 1;
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    border-radius: 50%; transition: background 0.15s;
  `,t.onmouseenter=()=>t.style.background="#f0f0f0",t.onmouseleave=()=>t.style.background="none",t.onclick=()=>{c(),r.onCancel?.()};let n=document.createElement("iframe"),i=new URL(e);i.searchParams.set("embed","true"),n.src=i.toString(),n.style.cssText=`
    width: 100%; height: 100%; border: none;
  `,a.appendChild(t),a.appendChild(n),o.appendChild(a),o.addEventListener("click",s=>{s.target===o&&(c(),r.onCancel?.())});let p=s=>{!s.data||typeof s.data!="object"||(s.data.type==="cashtap:success"?(c(),r.onSuccess?.(s.data.payload)):s.data.type==="cashtap:cancel"?(c(),r.onCancel?.()):s.data.type==="cashtap:error"&&(c(),r.onError?.(new Error(s.data.message||"Payment failed"))))};if(window.addEventListener("message",p),o.dataset.messageHandler="true",o._messageHandler=p,!document.getElementById("cashtap-styles")){let s=document.createElement("style");s.id="cashtap-styles",s.textContent=`
      @keyframes cashtap-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `,document.head.appendChild(s)}document.body.appendChild(o),m=o}function c(){if(m){let e=m._messageHandler;e&&window.removeEventListener("message",e),m.remove(),m=null}}var E=`<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="16" fill="#0AC18E"/>
  <path d="M21.2 13.6c.4-2.6-1.6-4-4.3-4.9l.9-3.5-2.1-.5-.8 3.4c-.6-.1-1.1-.3-1.7-.4l.9-3.4-2.1-.5-.9 3.5c-.5-.1-.9-.2-1.4-.3l-2.9-.7-.6 2.2s1.6.4 1.5.4c.9.2 1 .8 1 1.2l-1 4.1c.1 0 .1 0 .2.1h-.2l-1.4 5.8c-.1.3-.4.7-.9.6 0 0-1.5-.4-1.5-.4l-1 2.4 2.7.7c.5.1 1 .3 1.5.4l-.9 3.5 2.1.5.9-3.5c.6.2 1.1.3 1.7.4l-.9 3.5 2.1.5.9-3.5c3.7.7 6.5.4 7.7-2.9.9-2.7 0-4.2-2-5.2 1.4-.3 2.5-1.3 2.8-3.2zm-5 7c-.7 2.7-5.2 1.2-6.6.9l1.2-4.7c1.5.4 6.1 1.1 5.4 3.8zm.7-7c-.6 2.4-4.4 1.2-5.6.9l1.1-4.3c1.2.3 5.2.9 4.5 3.4z" fill="white"/>
</svg>`;function u(e){let r=document.getElementById(e.containerId);if(!r){console.error(`[CashTap] Container #${e.containerId} not found`);return}let o=e.buttonSize||"medium",t={small:{padding:"8px 16px",fontSize:"13px",gap:"6px"},medium:{padding:"12px 24px",fontSize:"15px",gap:"8px"},large:{padding:"16px 32px",fontSize:"17px",gap:"10px"}}[o],n=document.createElement("button");n.innerHTML=`${E}<span>${e.buttonText||"Pay with BCH"}</span>`,n.style.cssText=`
    display: inline-flex; align-items: center; gap: ${t.gap};
    padding: ${t.padding}; font-size: ${t.fontSize};
    background: ${e.buttonColor||"#0AC18E"};
    color: ${e.buttonTextColor||"#fff"};
    border: none; border-radius: 10px; cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 600; transition: opacity 0.15s, transform 0.1s;
    line-height: 1;
  `,n.onmouseenter=()=>n.style.opacity="0.9",n.onmouseleave=()=>n.style.opacity="1",n.onmousedown=()=>n.style.transform="scale(0.97)",n.onmouseup=()=>n.style.transform="scale(1)",n.onclick=async()=>{n.disabled=!0,n.style.opacity="0.7";try{let i=e.apiKey||"",p=e.apiUrl;if(i){let s=await d(i,e.amount,{memo:e.memo,successUrl:window.location.href,cancelUrl:window.location.href,apiUrl:p});l(s.checkout_url,{onSuccess:e.onSuccess,onError:e.onError,onCancel:e.onCancel})}else{let s=`${p||""}/pay/${e.merchant}?amount=${e.amount}`;l(s,{onSuccess:e.onSuccess,onError:e.onError,onCancel:e.onCancel})}}catch(i){e.onError?.(i instanceof Error?i:new Error(String(i)))}finally{n.disabled=!1,n.style.opacity="1"}},r.appendChild(n)}var S={button:u,createCheckout:d,openModal:l,closeModal:c};return w(k);})();
