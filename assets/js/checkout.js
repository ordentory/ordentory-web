const STORE_API_ORIGIN="https://api.ordentory.kr";
const STORE_API=STORE_API_ORIGIN+"/v1/store";
const CUSTOMER_API=STORE_API_ORIGIN+"/v1/customer";

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
const billingPreference=document.getElementById("billing-preference");

let checkout=null;
let widgets=null;
let paymentMethodWidget=null;
let agreementWidget=null;
let currentOffer=null;
let expiryTimer=null;
let customerSession=null;

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

function stopExpiryCountdown(){
  if(expiryTimer){clearInterval(expiryTimer);expiryTimer=null;}
}

function startExpiryCountdown(expiresAt){
  stopExpiryCountdown();
  const node=document.getElementById("summary-expiry");
  const end=new Date(expiresAt).getTime();
  if(!Number.isFinite(end)){node.textContent="-";return;}
  const tick=()=>{
    const remaining=Math.max(0,Math.ceil((end-Date.now())/1000));
    if(remaining<=0){
      node.textContent="주문 유효시간 만료";
      requestButton.disabled=true;
      requestButton.textContent="주문 유효시간 만료 · 다시 준비";
      stopExpiryCountdown();
      return;
    }
    const minutes=Math.floor(remaining/60);
    const seconds=String(remaining%60).padStart(2,"0");
    node.textContent=minutes+"분 "+seconds+"초";
  };
  tick();
  expiryTimer=setInterval(tick,1000);
}

async function loadCustomerSession(){
  try{
    const response=await fetch(CUSTOMER_API+"/auth/session",{method:"GET",credentials:"include",cache:"no-store"});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body?.email)throw new Error("login required");
    customerSession=body;
    emailInput.value=body.email;
    return body;
  }catch(_){
    location.href="/login.html?next=/checkout.html";
    throw new Error("login required");
  }
}

async function loadOffer(){
  prepareButton.disabled=true;
  prepareButton.textContent="판매가 확인 중…";
  try{
    const response=await fetch(STORE_API+"/offer",{method:"GET",credentials:"omit",cache:"no-store"});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(readMessage(body,"현재 판매가를 확인하지 못했습니다."));
    if(!validPositiveInteger(body.currentPrice)||!validPositiveInteger(body.regularPrice)){
      throw new Error("판매가 응답이 올바르지 않습니다.");
    }
    renderOffer(body);
    prepareButton.disabled=false;
    prepareButton.textContent="결제수단 선택";
  }catch(_){
    currentOffer=null;
    currentPriceNode.textContent="판매 준비 중";
    regularPriceNode.hidden=true;
    regularPriceNode.textContent="";
    offerStatusNode.textContent="현재 판매가를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    prepareButton.disabled=true;
    prepareButton.textContent="판매 준비 중";
  }
}

async function preparePayment(){
  checkoutError.textContent="";
  const email=customerSession?.email?.trim().toLowerCase()||"";
  if(!email){
    location.href="/login.html?next=/checkout.html";
    return;
  }
  const policyConsent=document.getElementById("checkout-policy-consent");
  const deliveryConsent=document.getElementById("checkout-delivery-consent");
  if(!policyConsent?.checked){
    checkoutError.textContent="이용약관, 개인정보처리방침, 환불 안내와 구매 조건을 확인해 주세요.";
    return;
  }
  if(!deliveryConsent?.checked){
    checkoutError.textContent="결제 후 즉시 디지털 제공이 시작되고 청약철회가 제한될 수 있다는 안내를 확인해 주세요.";
    return;
  }
  if(!currentOffer){
    checkoutError.textContent="현재 판매가를 확인한 뒤 결제를 진행할 수 있습니다.";
    await loadOffer();
    return;
  }
  prepareButton.disabled=true;
  prepareButton.textContent="결제 준비 중…";
  try{
    const response=await fetch(CUSTOMER_API+"/store/checkouts",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({billingPreference:billingPreference?.value||"AUTO"}),
      credentials:"include",
      cache:"no-store"
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      if(body?.error?.code==="CUSTOMER_UNAUTHORIZED"||body?.error?.code==="CUSTOMER_LOGIN_REQUIRED"){location.href="/login.html?next=/checkout.html";return;}
      if(body?.error?.code==="BILLING_PROFILE_REQUIRED"){throw new Error("전자세금계산서를 요청하려면 My ORDENTORY에서 사업자정보를 먼저 입력해 주세요.");}
      throw new Error(readMessage(body,"결제 주문을 준비하지 못했습니다."));
    }
    if(!body.orderId||!body.clientKey||!body.customerKey||!validPositiveInteger(body.amount)){
      throw new Error("결제 주문 응답이 올바르지 않습니다.");
    }

    checkout=body;
    document.getElementById("summary-email").textContent=checkout.buyerEmail;
    document.getElementById("summary-price").textContent=money(checkout.amount);
    summaryOfferNode.textContent=checkout.launchOffer?"출시 기념가":"정가";
    startExpiryCountdown(checkout.expiresAt);

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
  stopExpiryCountdown();
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
billingPreference?.addEventListener("change",()=>{checkoutError.textContent="";});

(async()=>{await loadCustomerSession();await loadOffer();})();
