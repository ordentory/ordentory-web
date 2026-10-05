const CUSTOMER_PUBLIC_API="https://api.ordentory.kr/v1/customer/public";
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function date(v){if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
async function load(path){try{const r=await fetch(CUSTOMER_PUBLIC_API+path,{credentials:"omit",cache:"no-store"});if(!r.ok)return {items:[]};return r.json().catch(()=>({items:[]}))}catch{return {items:[]}}}
function statusLabel(s){return ({REVIEWING:"검토 중",PLANNED:"개발 예정",IN_PROGRESS:"개발 중",COMPLETED:"완료",ON_HOLD:"보류",SUBMITTED:"접수"})[s]||s}
async function bootFeedback(){
  const [reviews,roadmap]=await Promise.all([load("/reviews?limit=50"),load("/roadmap")]);
  const reviewItems=reviews.items||[],roadmapItems=roadmap.items||[];
  const reviewNode=document.getElementById("public-reviews");
  reviewNode.innerHTML=reviewItems.length?reviewItems.map(x=>`<article class="public-review"><div class="portal-review-stars">${"★".repeat(Number(x.rating)||0)}${"☆".repeat(Math.max(0,5-(Number(x.rating)||0)))}</div><h3>${esc(x.title||"ORDENTORY 구매후기")}</h3><p>${esc(x.body)}</p>${x.adminResponse?`<div class="portal-note"><strong>ORDENTORY 답변</strong><br>${esc(x.adminResponse)}</div>`:""}<footer>구매 인증 · ${esc(x.displayName||"구매자")} · ${date(x.publishedAt||x.createdAt)}</footer></article>`).join(""):'<div class="portal-empty">공개된 구매후기가 아직 없습니다. 실제 구매후기가 등록되면 이곳에 표시됩니다.</div>';
  const groups=["IN_PROGRESS","PLANNED","REVIEWING","COMPLETED"];
  const roadmapNode=document.getElementById("public-roadmap");
  roadmapNode.innerHTML=roadmapItems.length?groups.map(status=>{
    const xs=roadmapItems.filter(x=>x.status===status);if(!xs.length)return "";
    return `<section class="roadmap-column"><h2 style="font-size:18px;margin:8px 0">${statusLabel(status)}</h2>${xs.map(x=>`<article class="roadmap-card">${x.plannedVersion?`<span class="account-badge ${String(status).toLowerCase()}">${esc(x.plannedVersion)}</span>`:`<span class="account-badge ${String(status).toLowerCase()}">${statusLabel(status)}</span>`}<h3>${esc(x.title)}</h3><p>${esc(x.body)}</p>${x.adminResponse?`<div class="portal-note">${esc(x.adminResponse)}</div>`:""}</article>`).join("")}</section>`;
  }).join(""):'<div class="portal-empty">공개된 개발현황이 아직 없습니다.</div>';
}
bootFeedback();
