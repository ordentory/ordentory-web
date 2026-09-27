const STORE_API="https://api.ordentory.kr/v1/store";
const loading=document.getElementById("result-loading");
const success=document.getElementById("result-success");
const errorView=document.getElementById("result-error");
const errorMessage=document.getElementById("result-error-message");

function showError(message){
  loading.hidden=true;
  success.hidden=true;
  errorView.hidden=false;
  if(message)errorMessage.textContent=message;
}

async function confirmPayment(){
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
    if(!response.ok)throw new Error(body?.error?.message||body?.message||"결제 확인에 실패했습니다.");
    document.getElementById("license-code").textContent=body.licenseCode||"";
    const installer=document.getElementById("installer-link");
    if(body.installerUrl)installer.href=body.installerUrl;
    loading.hidden=true;
    errorView.hidden=true;
    success.hidden=false;
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
  }catch{}
});

confirmPayment();
