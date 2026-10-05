const CUSTOMER_API="https://api.ordentory.kr/v1/customer";
const API_ORIGIN="https://api.ordentory.kr";
const state={session:null,overview:null,business:null,reviews:[],features:[],tickets:[]};

function el(id){return document.getElementById(id)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function date(v){if(!v)return "-";const d=new Date(v);return Number.isNaN(d.getTime())?"-":new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function money(v){return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW",maximumFractionDigits:0}).format(Number(v||0))}
function badge(v){return `<span class="account-badge ${esc(String(v||"").toLowerCase())}">${esc(v||"-")}</span>`}
async function api(path,options={}){
  const response=await fetch(CUSTOMER_API+path,{credentials:"include",cache:"no-store",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const body=response.status===204?{}:await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(body?.error?.message||"요청을 처리하지 못했습니다.");error.code=body?.error?.code||"";throw error}
  return body;
}
async function publicApi(url){const r=await fetch(url,{credentials:"omit",cache:"no-store"});return r.ok?r.json():{}}

function nav(){
  document.querySelectorAll(".portal-nav button").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".portal-nav button").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".portal-panel").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");el(b.dataset.panel).classList.add("active");
  }));
}
function renderSummary(){
  const licenses=state.overview?.licenses||[],devices=state.overview?.devices||[],orders=state.overview?.orders||[];
  el("summary-license-count").textContent=licenses.filter(x=>x.status==="ACTIVE").length;
  el("summary-device-count").textContent=devices.filter(x=>x.status==="ACTIVE").length;
  el("summary-order-count").textContent=orders.filter(x=>x.status==="PAID").length;
  el("portal-name").textContent=state.session?.fullName||state.session?.email||"고객";
  const latest=licenses[0];
  el("dashboard-product").innerHTML=latest?`<div class="portal-item"><div class="portal-item-head"><div><div class="portal-item-title">ORDENTORY Inventory</div><div class="portal-item-meta"><span>${esc(latest.licenseType)}</span><span>${latest.perpetual?"영구 사용권":"기간형"}</span><span>활성 PC ${latest.activeDevices}/${latest.deviceLimit}</span></div></div>${badge(latest.status)}</div></div>`:'<div class="portal-empty">아직 연결된 정식 라이선스가 없습니다.</div>';
}
function renderLicenses(){
  const items=state.overview?.licenses||[];
  el("licenses-list").innerHTML=items.length?items.map(x=>`<article class="portal-item"><div class="portal-item-head"><div><div class="portal-item-title">ORDENTORY Inventory</div><div class="portal-item-meta"><span>${esc(x.code)}</span><span>${esc(x.issueSource)}</span><span>발급 ${date(x.createdAt)}</span></div></div>${badge(x.status)}</div><div class="portal-item-meta"><span>모듈: ${esc((x.modules||[]).join(", ")||"-")}</span><span>PC ${x.activeDevices}/${x.deviceLimit}</span><span>${x.perpetual?"영구 사용권":"기간형"}</span></div></article>`).join(""):'<div class="portal-empty">연결된 라이선스가 없습니다. 구매에 사용한 이메일과 현재 계정 이메일이 같은지 확인해 주세요.</div>';
}
function renderDevices(){
  const items=state.overview?.devices||[];
  el("devices-list").innerHTML=items.length?items.map(x=>`<article class="portal-item"><div class="portal-item-head"><div><div class="portal-item-title">${esc(x.name||"ORDENTORY Windows PC")}</div><div class="portal-item-meta"><span>${esc(x.licenseCode)}</span><span>등록 ${date(x.activatedAt)}</span><span>최근 확인 ${date(x.lastSeenAt)}</span></div></div>${badge(x.status)}</div>${x.status==="ACTIVE"?`<div class="portal-item-actions"><button class="portal-small-button danger" data-release-device="${esc(x.id)}" data-license-id="${esc(x.licenseId)}">이 PC 해제</button></div>`:""}</article>`).join(""):'<div class="portal-empty">등록된 PC가 없습니다.</div>';
  document.querySelectorAll("[data-release-device]").forEach(b=>b.addEventListener("click",()=>releaseDevice(b)));
}
async function releaseDevice(button){
  if(!confirm("이 PC의 활성화를 해제하시겠습니까? 해제 후 다시 사용하려면 라이선스를 재활성화해야 합니다."))return;
  button.disabled=true;
  try{
    await api(`/licenses/${encodeURIComponent(button.dataset.licenseId)}/devices/${encodeURIComponent(button.dataset.releaseDevice)}/release`,{method:"POST",body:"{}"});
    await loadOverview();el("portal-message").textContent="PC가 해제되었습니다.";
  }catch(err){alert(err.message)}
  finally{button.disabled=false}
}
function renderOrders(){
  const items=state.overview?.orders||[];
  el("orders-list").innerHTML=items.length?items.map(x=>`<article class="portal-item"><div class="portal-item-head"><div><div class="portal-item-title">${esc(x.productCode||"ORDENTORY")}</div><div class="portal-item-meta"><span>${esc(x.salesChannel)}</span><span>주문 ${esc(x.externalOrderId)}</span><span>${date(x.purchasedAt)}</span></div></div>${badge(x.status)}</div><div class="portal-item-meta"><span>${money(x.totalAmount)}</span><span>${esc(x.currency)}</span></div></article>`).join(""):'<div class="portal-empty">구매내역이 없습니다.</div>';
  const select=el("review-order");
  select.innerHTML='<option value="">구매건 선택</option>'+items.filter(x=>x.status==="PAID").map(x=>`<option value="${esc(x.id)}">${esc(x.productCode||"ORDENTORY")} · ${date(x.purchasedAt)} · ${esc(x.salesChannel)}</option>`).join("");
}
async function loadOverview(){state.overview=await api("/portal/overview");renderSummary();renderLicenses();renderDevices();renderOrders()}
async function loadBusiness(){
  state.business=await api("/business-profile");
  const map={"business-no":"businessRegistrationNumber","business-company":"companyName","business-rep":"representativeName","business-address1":"addressLine1","business-address2":"addressLine2","business-type":"businessType","business-item":"businessItem","business-email":"taxInvoiceEmail"};
  Object.entries(map).forEach(([id,key])=>el(id).value=state.business?.[key]||"");
}
async function loadFeedback(){
  const [r,f,t]=await Promise.all([api("/reviews"),api("/features"),api("/support")]);
  state.reviews=r.items||[];state.features=f.items||[];state.tickets=t.items||[];
  el("my-reviews").innerHTML=state.reviews.length?state.reviews.map(x=>`<div class="portal-item"><div class="portal-item-head"><strong class="portal-review-stars">${"★".repeat(x.rating)}${"☆".repeat(5-x.rating)}</strong>${badge(x.moderationStatus)}</div><div class="portal-item-title">${esc(x.title||"구매후기")}</div><div class="portal-item-meta"><span>작성 ${date(x.createdAt)}</span><span>${esc(x.productCode)}</span></div></div>`).join(""):'<div class="portal-empty">작성한 구매후기가 없습니다.</div>';
  el("my-features").innerHTML=state.features.length?state.features.map(x=>`<div class="portal-item"><div class="portal-item-head"><div class="portal-item-title">${esc(x.title)}</div>${badge(x.status)}</div><div class="portal-item-meta"><span>등록 ${date(x.createdAt)}</span>${x.plannedVersion?`<span>예정 ${esc(x.plannedVersion)}</span>`:""}<span>${x.publicOnRoadmap?"공개 개발현황":"비공개 제안"}</span></div>${x.adminResponse?`<div class="portal-note">ORDENTORY 답변: ${esc(x.adminResponse)}</div>`:""}</div>`).join(""):'<div class="portal-empty">등록한 기능제안이 없습니다.</div>';
  el("my-tickets").innerHTML=state.tickets.length?state.tickets.map(x=>`<button class="portal-item" style="text-align:left;cursor:pointer" data-ticket="${esc(x.id)}"><div class="portal-item-head"><div class="portal-item-title">${esc(x.subject)}</div>${badge(x.status)}</div><div class="portal-item-meta"><span>${x.kind==="BUG"?"버그 신고":"문의"}</span><span>최근 ${date(x.updatedAt)}</span></div></button>`).join(""):'<div class="portal-empty">등록한 문의가 없습니다.</div>';
  document.querySelectorAll("[data-ticket]").forEach(b=>b.addEventListener("click",()=>openTicket(b.dataset.ticket)));
}
async function openTicket(id){
  try{
    const thread=await api("/support/"+encodeURIComponent(id));
    const lines=(thread.messages||[]).map(m=>`[${m.authorType==="ADMIN"?"ORDENTORY":m.authorType==="CUSTOMER"?"고객":"시스템"}] ${m.body}`).join("\n\n");
    el("ticket-thread-title").textContent=thread.ticket.subject;el("ticket-thread-body").textContent=lines;el("ticket-thread").hidden=false;el("support-reply-ticket-id").value=id;
  }catch(err){alert(err.message)}
}
async function loadRelease(){
  try{
    const r=await publicApi(API_ORIGIN+"/v1/releases/latest?application=ORDENTORY&channel=stable");
    const version=r.version||r.release?.version||"1.0.0";
    el("latest-version").textContent=version.startsWith("v")?version:"v"+version;
    el("latest-notes").textContent=r.releaseNotes||r.release?.releaseNotes||"최신 안정 버전";
  }catch{}
}
async function boot(){
  nav();
  try{
    state.session=await api("/auth/session");
    el("account-email").textContent=state.session.email;
    await Promise.all([loadOverview(),loadBusiness(),loadFeedback(),loadRelease()]);
    el("portal-loading").hidden=true;el("portal-content").hidden=false;
  }catch(err){
    if(err.code==="CUSTOMER_UNAUTHORIZED"||err.code==="CUSTOMER_PORTAL_DISABLED"||err.message.includes("로그인")){
      location.href="/login.html?next=/my.html";return;
    }
    el("portal-loading").textContent=err.message;
  }
}
el("logout-button").addEventListener("click",async()=>{try{await api("/auth/logout",{method:"POST",body:"{}"})}catch{}location.href="/"});
el("business-form").addEventListener("submit",async e=>{
  e.preventDefault();const msg=el("business-message");msg.textContent="";
  try{
    state.business=await api("/business-profile",{method:"PUT",body:JSON.stringify({
      businessRegistrationNumber:el("business-no").value.trim(),companyName:el("business-company").value.trim(),representativeName:el("business-rep").value.trim(),addressLine1:el("business-address1").value.trim(),addressLine2:el("business-address2").value.trim(),businessType:el("business-type").value.trim(),businessItem:el("business-item").value.trim(),taxInvoiceEmail:el("business-email").value.trim()
    })});msg.textContent="사업자 정보를 저장했습니다.";
  }catch(err){msg.textContent=err.message}
});
el("review-form").addEventListener("submit",async e=>{
  e.preventDefault();const msg=el("review-message");msg.textContent="";
  try{await api("/reviews",{method:"POST",body:JSON.stringify({orderId:el("review-order").value,rating:Number(el("review-rating").value),title:el("review-title").value.trim(),body:el("review-body").value.trim(),displayNameMode:el("review-display").value})});e.target.reset();msg.textContent="후기가 등록되었습니다. 관리자 확인 후 공개됩니다.";await loadFeedback()}catch(err){msg.textContent=err.message}
});
el("feature-form").addEventListener("submit",async e=>{
  e.preventDefault();const msg=el("feature-message");msg.textContent="";
  try{await api("/features",{method:"POST",body:JSON.stringify({licenseId:el("feature-license").value,title:el("feature-title").value.trim(),body:el("feature-body").value.trim()})});e.target.reset();msg.textContent="기능제안이 등록되었습니다.";await loadFeedback()}catch(err){msg.textContent=err.message}
});
el("support-form").addEventListener("submit",async e=>{
  e.preventDefault();const msg=el("support-message");msg.textContent="";
  try{await api("/support",{method:"POST",body:JSON.stringify({licenseId:el("support-license").value,kind:el("support-kind").value,subject:el("support-subject").value.trim(),body:el("support-body").value.trim()})});e.target.reset();msg.textContent="문의가 등록되었습니다.";await loadFeedback()}catch(err){msg.textContent=err.message}
});
el("support-reply-form").addEventListener("submit",async e=>{
  e.preventDefault();const id=el("support-reply-ticket-id").value,body=el("support-reply-body").value.trim();if(!id||!body)return;
  try{await api("/support/"+encodeURIComponent(id)+"/messages",{method:"POST",body:JSON.stringify({body})});el("support-reply-body").value="";await openTicket(id);await loadFeedback()}catch(err){alert(err.message)}
});
boot();
