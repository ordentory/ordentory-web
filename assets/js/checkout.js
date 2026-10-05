const STORE_API_ORIGIN="https://api.ordentory.kr";
const STORE_API=STORE_API_ORIGIN+"/v1/store";

const emailInput=document.getElementById("buyer-email");
const prepareButton=document.getElementById("prepare-payment");
const startView=document.getElementById("checkout-start");
const paymentView=document.getElementById("checkout-payment");
const checkoutError=document.getElementById("checkout-error");
const paymentError=document.getElementById("payment-error");
const requestButton=document.getElementById("request-payment");
const changeEmail=document.getElementById("change-email");
const currentPriceNode=document.getElementById("offer-current-price");
const regularPriceNode=document.getElementById("offer-regular-price");
const offerStatusNode=document.getElementById("offer-status");
const summaryOfferNode=document.getElementById("summary-offer");

let checkout=null;
let widgets=null;
let paymentMethodWidget=null;
let agreementWidget=null;
let currentOffer=null;

function money(value){
  return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW",maximumFractionDigits:0}).format(Number(value||0));
}

function readMessage(body,fallback){
  return body?.error?.message||body?.message||fallback;
}

function validPositiveInteger(value){
  return Number.isInteger(Number(value))&&Number(value)>0;
}

function renderOffer(offer){
  currentOffer=offer;
  currentPriceNode.textContent=money(offer.currentPrice);
  const showRegular=offer.launchOffer&&Number(offer.regularPrice)>Number(offer.currentPrice);
  regularPriceNode.hidden=!showRegular;
  regularPriceNode.textContent=showRegular?money(offer.regularPrice):"";
  if(offer.launchOffer){
    const remaining=Number.isInteger(Number(offer.launchRemaining))?Number(offer.launchRemaining):0;
    offerStatusNode.textContent=remaining>0
      ?`출시 기념 할인 적용 · 남은 ${remaining}개`
      :"출시 기념 할인 적용";
  }else{
    offerStatusNode.textContent="현재 정가 적용";
  }
}

async function loadOffer(){
  try{
    const response=await fetch(STORE_API+"/offer",{method:"GET",credentials:"omit",cache:"no-store"});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(readMessage(body,"현재 판매가를 확인하지 못했습니다."));
    if(!validPositiveInteger(body.currentPrice)||!validPositiveInteger(body.regularPrice)){
      throw new Error("판매가 응답이 올바르지 않습니다.");
    }
    renderOffer(body);
  }catch(_){
    currentOffer=null;
    currentPriceNode.textContent="결제 준비 시 확정";
    regularPriceNode.hidden=true;
    regularPriceNode.textContent="";
    offerStatusNode.textContent="결제수단 선택 시 서버에서 최종 가격을 다시 확인합니다.";
  }
}

async function preparePayment(){
  checkoutError.textContent="";
  const email=emailInput.value.trim();
  if(!email||!emailInput.checkValidity()){
    emailInput.reportValidity();
    return;
  }
  const policyConsent=document.getElementById("checkout-policy-consent");
  if(!policyConsent?.checked){
    checkoutError.textContent="이용약관, 개인정보처리방침, 환불 안내와 구매 조건을 확인해 주세요.";
    return;
  }
  prepareButton.disabled=true;
  prepareButton.textContent="결제 준비 중…";
  try{
    const response=await fetch(STORE_API+"/checkouts",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({buyerEmail:email}),
      credentials:"omit",
      cache:"no-store"
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(readMessage(body,"결제 주문을 준비하지 못했습니다."));
    if(!body.orderId||!body.clientKey||!body.customerKey||!validPositiveInteger(body.amount)){
      throw new Error("결제 주문 응답이 올바르지 않습니다.");
    }

    checkout=body;
    document.getElementById("summary-email").textContent=checkout.buyerEmail;
    document.getElementById("summary-price").textContent=money(checkout.amount);
    summaryOfferNode.textContent=checkout.launchOffer
      ?"서버에서 출시 기념 할인가를 예약했습니다. 결제 완료 전까지 이 주문에 적용됩니다."
      :"현재 정가가 적용됩니다.";

    currentPriceNode.textContent=money(checkout.amount);
    const showRegular=checkout.launchOffer&&currentOffer&&Number(currentOffer.regularPrice)>Number(checkout.amount);
    regularPriceNode.hidden=!showRegular;
    if(showRegular)regularPriceNode.textContent=money(currentOffer.regularPrice);
    offerStatusNode.textContent=checkout.launchOffer
      ?"출시 기념 할인 · 결제 주문에 적용됨"
      :"정가 · 결제 주문에 적용됨";

    if(typeof TossPayments!=="function") throw new Error("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
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
    paymentView.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    checkoutError.textContent=error?.message||"결제 준비 중 오류가 발생했습니다.";
  }finally{
    prepareButton.disabled=false;
    prepareButton.textContent="결제수단 선택";
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
  checkoutError.textContent="";
  emailInput.focus();
  await loadOffer();
}

prepareButton.addEventListener("click",preparePayment);
requestButton.addEventListener("click",requestPayment);
changeEmail.addEventListener("click",resetCheckout);
emailInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();preparePayment();}});

loadOffer();
