const STORE_API="https://api.ordentory.kr/v1/store";

const emailInput=document.getElementById("buyer-email");
const prepareButton=document.getElementById("prepare-payment");
const startView=document.getElementById("checkout-start");
const paymentView=document.getElementById("checkout-payment");
const checkoutError=document.getElementById("checkout-error");
const paymentError=document.getElementById("payment-error");
const requestButton=document.getElementById("request-payment");
const changeEmail=document.getElementById("change-email");
const offerCurrentPrice=document.getElementById("offer-current-price");
const offerRegularPrice=document.getElementById("offer-regular-price");
const offerStatus=document.getElementById("offer-status");
const summaryExpiry=document.getElementById("summary-expiry");

let offer=null;
let checkout=null;
let widgets=null;
let paymentMethodWidget=null;
let agreementWidget=null;
let expiryTimer=null;

function money(value){
  return new Intl.NumberFormat("ko-KR",{style:"currency",currency:"KRW",maximumFractionDigits:0}).format(Number(value||0));
}

function readMessage(body,fallback){
  return body?.error?.message||body?.message||fallback;
}

function validOffer(value){
  return value &&
    value.productCode==="inventory" &&
    value.currency==="KRW" &&
    Number.isInteger(Number(value.currentPrice)) &&
    Number(value.currentPrice)>0 &&
    Number.isInteger(Number(value.regularPrice)) &&
    Number(value.regularPrice)>0 &&
    Number.isInteger(Number(value.launchPrice)) &&
    Number(value.launchPrice)>0 &&
    Number.isInteger(Number(value.launchLimit)) &&
    Number(value.launchLimit)>=0 &&
    Number.isInteger(Number(value.launchRemaining)) &&
    Number(value.launchRemaining)>=0;
}

function renderOffer(value){
  offer=value;
  const current=Number(value.currentPrice);
  const regular=Number(value.regularPrice);
  offerCurrentPrice.textContent=money(current);

  if(value.launchOffer && current<regular){
    offerRegularPrice.textContent="정가 "+money(regular);
    const remaining=Number(value.launchRemaining);
    offerStatus.textContent=remaining>0
      ? `출시 기념가 적용 가능 · 현재 ${remaining}개 남음`
      : "출시 기념가 적용 가능";
    offerStatus.classList.add("launch");
  }else{
    offerRegularPrice.textContent="";
    offerStatus.textContent="현재 정가로 판매 중";
    offerStatus.classList.remove("launch");
  }

  prepareButton.disabled=false;
  prepareButton.textContent="결제수단 선택하기";
}

async function loadOffer(){
  prepareButton.disabled=true;
  prepareButton.textContent="판매가 확인 중…";
  checkoutError.textContent="";
  try{
    const response=await fetch(STORE_API+"/offer",{
      method:"GET",
      headers:{"Accept":"application/json"},
      cache:"no-store"
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(readMessage(body,"현재 판매가를 확인하지 못했습니다."));
    if(!validOffer(body)) throw new Error("현재 판매가 정보가 올바르지 않습니다.");
    renderOffer(body);
  }catch(error){
    offer=null;
    offerCurrentPrice.textContent="판매 준비 중";
    offerRegularPrice.textContent="";
    offerStatus.textContent="현재 결제 서비스를 준비하고 있습니다.";
    offerStatus.classList.remove("launch");
    prepareButton.disabled=true;
    prepareButton.textContent="자사몰 결제 준비 중";
    checkoutError.textContent=error?.message||"현재 결제 서비스를 사용할 수 없습니다.";
  }
}

function stopExpiryTimer(){
  if(expiryTimer){
    clearInterval(expiryTimer);
    expiryTimer=null;
  }
}

function updateExpiry(){
  if(!checkout?.expiresAt){
    summaryExpiry.textContent="확인할 수 없음";
    return;
  }
  const expiry=new Date(checkout.expiresAt).getTime();
  if(!Number.isFinite(expiry)){
    summaryExpiry.textContent="확인할 수 없음";
    return;
  }
  const remaining=Math.max(0,Math.ceil((expiry-Date.now())/1000));
  if(remaining<=0){
    summaryExpiry.textContent="만료됨";
    requestButton.disabled=true;
    requestButton.textContent="주문 유효시간 만료";
    paymentError.textContent="주문 유효시간이 만료되었습니다. 구매 정보를 다시 입력해 새 주문을 준비해 주세요.";
    stopExpiryTimer();
    return;
  }
  const minutes=Math.floor(remaining/60);
  const seconds=remaining%60;
  summaryExpiry.textContent=`${minutes}분 ${String(seconds).padStart(2,"0")}초`;
}

function startExpiryTimer(){
  stopExpiryTimer();
  updateExpiry();
  expiryTimer=setInterval(updateExpiry,1000);
}

async function preparePayment(){
  checkoutError.textContent="";
  if(!offer){
    checkoutError.textContent="현재 판매가를 먼저 확인해 주세요.";
    return;
  }

  const email=emailInput.value.trim().toLowerCase();
  if(!email||!emailInput.checkValidity()){
    emailInput.reportValidity();
    return;
  }

  const policyConsent=document.getElementById("checkout-policy-consent");
  const deliveryConsent=document.getElementById("checkout-delivery-consent");
  if(!policyConsent?.checked){
    checkoutError.textContent="이용약관, 개인정보처리방침, 환불 안내를 확인해 주세요.";
    return;
  }
  if(!deliveryConsent?.checked){
    checkoutError.textContent="결제 완료 후 디지털 라이선스와 다운로드 링크가 즉시 제공되는 것을 확인해 주세요.";
    return;
  }

  prepareButton.disabled=true;
  prepareButton.textContent="주문 준비 중…";

  try{
    const response=await fetch(STORE_API+"/checkouts",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({buyerEmail:email})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(readMessage(body,"결제 주문을 준비하지 못했습니다."));
    if(!body.orderId||!body.clientKey||!body.customerKey||!body.successUrl||!body.failUrl||
       !Number.isInteger(Number(body.amount))||Number(body.amount)<=0){
      throw new Error("결제 주문 정보가 올바르지 않습니다.");
    }

    checkout=body;
    const reservedAmount=Number(checkout.amount);
    document.getElementById("summary-email").textContent=checkout.buyerEmail||email;
    document.getElementById("summary-price").textContent=money(reservedAmount);
    document.getElementById("summary-offer").textContent=checkout.launchOffer?"출시 기념가":"정가";

    if(offer && reservedAmount!==Number(offer.currentPrice)){
      offerCurrentPrice.textContent=money(reservedAmount);
      offerRegularPrice.textContent=checkout.launchOffer&&reservedAmount<Number(offer.regularPrice)
        ?"정가 "+money(offer.regularPrice)
        :"";
      offerStatus.textContent="결제 준비 시점의 서버 확정 가격으로 갱신됨";
      offerStatus.classList.toggle("launch",Boolean(checkout.launchOffer));
    }

    if(typeof TossPayments!=="function") throw new Error("결제 모듈을 불러오지 못했습니다.");
    const tossPayments=TossPayments(checkout.clientKey);
    widgets=tossPayments.widgets({customerKey:checkout.customerKey});
    await widgets.setAmount({value:reservedAmount,currency:checkout.currency||"KRW"});
    [paymentMethodWidget,agreementWidget]=await Promise.all([
      widgets.renderPaymentMethods({selector:"#payment-method"}),
      widgets.renderAgreement({selector:"#agreement"})
    ]);

    startView.hidden=true;
    paymentView.hidden=false;
    requestButton.disabled=false;
    requestButton.textContent="결제하기";
    startExpiryTimer();
  }catch(error){
    checkout=null;
    checkoutError.textContent=error?.message||"결제 준비 중 오류가 발생했습니다.";
  }finally{
    if(startView.hidden===false){
      prepareButton.disabled=!offer;
      prepareButton.textContent=offer?"결제수단 선택하기":"자사몰 결제 준비 중";
    }
  }
}

async function requestPayment(){
  if(!checkout||!widgets)return;
  paymentError.textContent="";

  const expiry=new Date(checkout.expiresAt||"").getTime();
  if(!Number.isFinite(expiry)||Date.now()>=expiry){
    updateExpiry();
    return;
  }

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
  stopExpiryTimer();
  try{if(paymentMethodWidget?.destroy)await paymentMethodWidget.destroy()}catch{}
  try{if(agreementWidget?.destroy)await agreementWidget.destroy()}catch{}
  checkout=null;
  widgets=null;
  paymentMethodWidget=null;
  agreementWidget=null;
  paymentView.hidden=true;
  startView.hidden=false;
  requestButton.disabled=true;
  requestButton.textContent="결제하기";
  paymentError.textContent="";
  checkoutError.textContent="";
  prepareButton.disabled=!offer;
  prepareButton.textContent=offer?"결제수단 선택하기":"자사몰 결제 준비 중";
  emailInput.focus();
}

prepareButton.addEventListener("click",preparePayment);
requestButton.addEventListener("click",requestPayment);
changeEmail.addEventListener("click",resetCheckout);
emailInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();preparePayment();}});

loadOffer();
