const STORE_API="https://api.ordentory.kr/v1/store";
const STORE_PAYMENTS_ENABLED=document.body?.dataset?.storePaymentsEnabled==="true";
const REVIEW_DISABLED_MESSAGE="현재 PG 심사 진행 중으로 결제 요청이 비활성화되어 있습니다.";

const emailInput=document.getElementById("buyer-email");
const prepareButton=document.getElementById("prepare-payment");
const startView=document.getElementById("checkout-start");
const paymentView=document.getElementById("checkout-payment");
const checkoutError=document.getElementById("checkout-error");
const paymentError=document.getElementById("payment-error");
const requestButton=document.getElementById("request-payment");
const changeEmail=document.getElementById("change-email");

let checkout=null;
let widgets=null;
let paymentMethodWidget=null;
let agreementWidget=null;

function money(value){
  return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW",maximumFractionDigits:0}).format(Number(value||0));
}

function readMessage(body,fallback){
  return body?.error?.message||body?.message||fallback;
}

async function preparePayment(){
  checkoutError.textContent="";
  if(!STORE_PAYMENTS_ENABLED){
    checkoutError.textContent=REVIEW_DISABLED_MESSAGE;
    return;
  }
  const email=emailInput.value.trim();
  if(!email||!emailInput.checkValidity()){
    emailInput.reportValidity();
    return;
  }
  const policyConsent=document.getElementById("checkout-policy-consent");
  if(!policyConsent?.checked){
    checkoutError.textContent="이용약관, 개인정보처리방침, 환불 안내를 확인해 주세요.";
    return;
  }
  prepareButton.disabled=true;
  prepareButton.textContent="결제 준비 중…";
  try{
    const response=await fetch(STORE_API+"/checkouts",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({buyerEmail:email})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(readMessage(body,"결제 주문을 준비하지 못했습니다."));

    checkout=body;
    document.getElementById("display-price").textContent=money(checkout.amount);
    document.getElementById("display-offer").textContent=checkout.launchOffer?"출시 기념 선착순 할인 적용":"정가";
    document.getElementById("summary-email").textContent=checkout.buyerEmail;
    document.getElementById("summary-price").textContent=money(checkout.amount);

    if(typeof TossPayments!=="function") throw new Error("결제 모듈을 불러오지 못했습니다.");
    const tossPayments=TossPayments(checkout.clientKey);
    widgets=tossPayments.widgets({customerKey:checkout.customerKey});
    await widgets.setAmount({value:Number(checkout.amount),currency:checkout.currency});
    [paymentMethodWidget,agreementWidget]=await Promise.all([
      widgets.renderPaymentMethods({selector:"#payment-method"}),
      widgets.renderAgreement({selector:"#agreement"})
    ]);

    startView.hidden=true;
    paymentView.hidden=false;
    requestButton.disabled=false;
  }catch(error){
    checkoutError.textContent=error?.message||"결제 준비 중 오류가 발생했습니다.";
  }finally{
    prepareButton.disabled=false;
    prepareButton.textContent="결제 준비";
  }
}

async function requestPayment(){
  if(!checkout||!widgets)return;
  paymentError.textContent="";
  requestButton.disabled=true;
  requestButton.textContent="결제창 여는 중…";
  try{
    await widgets.requestPayment({
      orderId:checkout.orderId,
      orderName:checkout.orderName,
      customerEmail:checkout.buyerEmail,
      successUrl:checkout.successUrl,
      failUrl:checkout.failUrl
    });
  }catch(error){
    paymentError.textContent=error?.message||"결제 요청을 시작하지 못했습니다.";
    requestButton.disabled=false;
    requestButton.textContent="결제하기";
  }
}

async function resetCheckout(){
  try{if(paymentMethodWidget?.destroy)await paymentMethodWidget.destroy()}catch{}
  try{if(agreementWidget?.destroy)await agreementWidget.destroy()}catch{}
  checkout=null;widgets=null;paymentMethodWidget=null;agreementWidget=null;
  paymentView.hidden=true;
  startView.hidden=false;
  requestButton.disabled=true;
  requestButton.textContent="결제하기";
  paymentError.textContent="";
  emailInput.focus();
}

if(!STORE_PAYMENTS_ENABLED){
  prepareButton.disabled=true;
  prepareButton.setAttribute("aria-disabled","true");
  prepareButton.textContent="결제 준비 중 · PG 심사 진행 중";
}
prepareButton.addEventListener("click",preparePayment);
requestButton.addEventListener("click",requestPayment);
changeEmail.addEventListener("click",resetCheckout);
emailInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&STORE_PAYMENTS_ENABLED)preparePayment()});
