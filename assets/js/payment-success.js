const STORE_API="https://api.ordentory.kr/v1/store";
const loading=document.getElementById("result-loading");
const success=document.getElementById("result-success");
const errorView=document.getElementById("result-error");
const errorMessage=document.getElementById("result-error-message");

function money(value){
  return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW",maximumFractionDigits:0}).format(Number(value||0));
}

function showError(message){
  loading.hidden=true;
  success.hidden=true;
  errorView.hidden=false;
  if(message) errorMessage.textContent=message;
}

function approvedInstaller(url){
  try{
    const parsed=new URL(url);
    return parsed.protocol==="https:" &&
      parsed.hostname==="api.ordentory.kr" &&
      parsed.pathname==="/v1/store/installer" &&
      !parsed.username && !parsed.password &&
      !parsed.search && !parsed.hash;
  }catch(_){
    return false;
  }
}

function validConfirmation(body){
  return body &&
    typeof body.orderId==="string" && body.orderId.startsWith("ORD-") &&
    typeof body.buyerEmail==="string" && body.buyerEmail.includes("@") &&
    Number.isInteger(Number(body.amount)) && Number(body.amount)>0 &&
    body.currency==="KRW" &&
    typeof body.licenseCode==="string" && body.licenseCode.startsWith("ORD-") &&
    Number(body.deviceLimit)===2 &&
    body.perpetual===true;
}

function renderSuccess(body,{cache=true}={}){
  if(!validConfirmation(body)){
    showError("구매 완료 정보를 확인하지 못했습니다. 재결제하지 말고 고객지원에 문의해 주세요.");
    return;
  }

  document.getElementById("purchase-order-id").textContent=body.orderId;
  document.getElementById("purchase-email").textContent=body.buyerEmail;
  document.getElementById("purchase-amount").textContent=money(body.amount);
  document.getElementById("license-code").textContent=body.licenseCode;

  const installer=document.getElementById("installer-link");
  if(body.installerUrl && approvedInstaller(body.installerUrl)){
    installer.href=body.installerUrl;
  }

  loading.hidden=true;
  errorView.hidden=true;
  success.hidden=false;

  if(cache){
    const state={
      orderId:body.orderId,
      buyerEmail:body.buyerEmail,
      amount:Number(body.amount),
      currency:"KRW",
      licenseCode:body.licenseCode,
      deviceLimit:2,
      perpetual:true,
      installerUrl:approvedInstaller(body.installerUrl)?body.installerUrl:"https://api.ordentory.kr/v1/store/installer"
    };
    history.replaceState({ordentoryPurchase:state},"","/payment-success.html");
  }
}

async function confirmPayment(){
  const cached=history.state?.ordentoryPurchase;
  if(validConfirmation(cached)){
    renderSuccess(cached,{cache:false});
    return;
  }

  const params=new URLSearchParams(location.search);
  const paymentKey=params.get("paymentKey");
  const orderId=params.get("orderId");
  const amount=Number(params.get("amount"));

  if(!paymentKey||!orderId||!Number.isInteger(amount)||amount<=0){
    showError("결제 승인에 필요한 정보가 올바르지 않습니다. 재결제하지 말고 고객지원에 문의해 주세요.");
    return;
  }

  try{
    const response=await fetch(STORE_API+"/payments/confirm",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({paymentKey,orderId,amount})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body?.error?.message||body?.message||"결제 확인에 실패했습니다.");

    if(body.orderId!==orderId || Number(body.amount)!==amount){
      throw new Error("결제 승인 결과가 요청한 주문 정보와 일치하지 않습니다.");
    }

    renderSuccess(body);
  }catch(error){
    showError(error?.message||"결제 확인을 완료하지 못했습니다. 재결제 전에 고객지원에 문의해 주세요.");
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
    setTimeout(()=>e.currentTarget.textContent="라이선스 코드 복사",1800);
  }
});

confirmPayment();
