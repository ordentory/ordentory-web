const STORE_API="https://api.ordentory.kr/v1/store";
const loading=document.getElementById("result-loading");
const success=document.getElementById("result-success");
const errorView=document.getElementById("result-error");
const errorMessage=document.getElementById("result-error-message");
const CACHE_PREFIX="ordentory-payment-result:";
const PENDING_PREFIX="ordentory-payment-pending:";

function money(value){
  return new Intl.NumberFormat("ko-KR",{
    style:"currency",currency:"KRW",maximumFractionDigits:0
  }).format(Number(value||0));
}

function safeSessionGet(key){
  try{
    const raw=sessionStorage.getItem(key);
    return raw?JSON.parse(raw):null;
  }catch{return null;}
}

function safeSessionSet(key,value){
  try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}
}

function safeSessionRemove(key){
  try{sessionStorage.removeItem(key);}catch{}
}

function validInstallerURL(value){
  try{
    const u=new URL(String(value||""));
    return u.protocol==="https:" &&
      u.hostname==="api.ordentory.kr" &&
      u.pathname==="/v1/store/installer" &&
      !u.username&&!u.password&&!u.search&&!u.hash;
  }catch{return false;}
}

function validLicenseCode(value){
  return /^ORD-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(String(value||""));
}

function validConfirmation(body,expectedOrderId,expectedAmount){
  return body &&
    body.orderId===expectedOrderId &&
    Number.isInteger(Number(body.amount)) &&
    Number(body.amount)===Number(expectedAmount) &&
    typeof body.buyerEmail==="string" &&
    body.buyerEmail.includes("@") &&
    validLicenseCode(body.licenseCode) &&
    Number(body.deviceLimit)===2 &&
    body.perpetual===true &&
    validInstallerURL(body.installerUrl);
}

function supportHref(orderId){
  const subject=orderId
    ?"ORDENTORY 결제 확인 문의 · "+orderId
    :"ORDENTORY 결제 확인 문의";
  return "mailto:support@ordentory.kr?subject="+encodeURIComponent(subject);
}

function showError(message,orderId){
  loading.hidden=true;
  success.hidden=true;
  errorView.hidden=false;
  if(message)errorMessage.textContent=message;
  document.getElementById("error-order-id").textContent=orderId||"확인되지 않음";
  document.getElementById("result-support-link").href=supportHref(orderId||"");
}

function renderSuccess(body){
  document.getElementById("result-order-id").textContent=body.orderId;
  document.getElementById("result-buyer-email").textContent=body.buyerEmail;
  document.getElementById("result-amount").textContent=money(body.amount);
  document.getElementById("license-code").textContent=body.licenseCode;
  document.getElementById("result-mail-text").textContent=
    body.buyerEmail+" 주소로 라이선스 코드, 서명된 설치파일 다운로드 링크, 사용자 매뉴얼과 활성화 방법을 자동 안내합니다. 메일 도착이 늦어도 아래 버튼에서 바로 설치를 진행할 수 있습니다.";
  document.getElementById("installer-link").href=body.installerUrl;
  loading.hidden=true;
  errorView.hidden=true;
  success.hidden=false;
}

function cachedConfirmation(orderId){
  const cached=safeSessionGet(CACHE_PREFIX+orderId);
  if(!cached) return null;
  if(!validConfirmation(cached,orderId,cached.amount)) return null;
  return cached;
}

async function confirmPayment(){
  const params=new URLSearchParams(location.search);
  const queryOrderId=String(params.get("orderId")||"").trim();
  const queryPaymentKey=String(params.get("paymentKey")||"").trim();
  const queryAmount=Number(params.get("amount"));

  if(queryOrderId){
    const cached=cachedConfirmation(queryOrderId);
    if(cached){
      renderSuccess(cached);
      history.replaceState(null,"","/payment-success.html?orderId="+encodeURIComponent(queryOrderId));
      return;
    }
  }

  let pending=null;
  if(queryPaymentKey&&queryOrderId&&Number.isInteger(queryAmount)&&queryAmount>0){
    pending={paymentKey:queryPaymentKey,orderId:queryOrderId,amount:queryAmount};
    safeSessionSet(PENDING_PREFIX+queryOrderId,pending);
    history.replaceState(null,"","/payment-success.html?orderId="+encodeURIComponent(queryOrderId));
  }else if(queryOrderId){
    pending=safeSessionGet(PENDING_PREFIX+queryOrderId);
  }

  if(!pending||!pending.paymentKey||!pending.orderId||
     !Number.isInteger(Number(pending.amount))||Number(pending.amount)<=0){
    showError(
      "결제 승인에 필요한 정보를 확인할 수 없습니다. 구매 완료 메일을 확인하거나 재결제하지 말고 고객지원에 문의해 주세요.",
      queryOrderId
    );
    return;
  }

  try{
    const response=await fetch(STORE_API+"/payments/confirm",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        paymentKey:pending.paymentKey,
        orderId:pending.orderId,
        amount:Number(pending.amount)
      }),
      credentials:"omit",
      cache:"no-store"
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      throw new Error(body?.error?.message||body?.message||"결제 확인에 실패했습니다.");
    }
    if(!validConfirmation(body,pending.orderId,pending.amount)){
      throw new Error("결제 확인 응답이 올바르지 않습니다. 재결제하지 말고 고객지원에 문의해 주세요.");
    }

    const stored={
      orderId:body.orderId,
      buyerEmail:body.buyerEmail,
      amount:Number(body.amount),
      currency:body.currency||"KRW",
      licenseCode:body.licenseCode,
      deviceLimit:Number(body.deviceLimit),
      perpetual:body.perpetual===true,
      installerUrl:body.installerUrl
    };
    safeSessionSet(CACHE_PREFIX+body.orderId,stored);
    safeSessionRemove(PENDING_PREFIX+body.orderId);
    history.replaceState(null,"","/payment-success.html?orderId="+encodeURIComponent(body.orderId));
    renderSuccess(stored);
  }catch(error){
    showError(
      error?.message||"결제 확인을 완료하지 못했습니다. 결제 상태가 불확실하므로 재결제 전에 고객지원에 문의해 주세요.",
      pending.orderId
    );
  }
}

document.getElementById("copy-license").addEventListener("click",async e=>{
  const code=document.getElementById("license-code").textContent.trim();
  if(!code)return;
  try{
    await navigator.clipboard.writeText(code);
    const prev=e.currentTarget.textContent;
    e.currentTarget.textContent="복사됨";
    setTimeout(()=>e.currentTarget.textContent=prev,1200);
  }catch{
    e.currentTarget.textContent="직접 복사해 주세요";
  }
});

confirmPayment();
