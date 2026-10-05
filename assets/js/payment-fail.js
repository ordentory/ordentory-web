const params=new URLSearchParams(location.search);
const message=(params.get("message")||"").trim();
const orderId=(params.get("orderId")||"").trim();

if(message){
  document.getElementById("fail-message").textContent=message.slice(0,300);
}
if(/^ORD-[A-Z0-9]+$/.test(orderId)){
  document.getElementById("fail-order-id").textContent=orderId;
  document.getElementById("fail-order-box").hidden=false;
}

history.replaceState({},"","/payment-fail.html");
