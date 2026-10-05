const CUSTOMER_API="https://api.ordentory.kr/v1/customer";

function q(id){return document.getElementById(id)}
async function api(path,options={}){
  const response=await fetch(CUSTOMER_API+path,{credentials:"include",cache:"no-store",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(body?.error?.message||"요청을 처리하지 못했습니다.");error.code=body?.error?.code||"";throw error}
  return body;
}

const loginForm=q("login-form");
if(loginForm){
  loginForm.addEventListener("submit",async(e)=>{
    e.preventDefault();
    const error=q("auth-error"); error.textContent="";
    const button=q("login-button");button.disabled=true;button.textContent="로그인 중…";
    try{
      await api("/auth/login",{method:"POST",body:JSON.stringify({email:q("login-email").value.trim(),password:q("login-password").value})});
      const next=new URLSearchParams(location.search).get("next");
      location.href=next&&next.startsWith("/")?next:"/my.html";
    }catch(err){error.textContent=err.message}
    finally{button.disabled=false;button.textContent="로그인"}
  });
}

let signupChallenge="";
const sendOtp=q("signup-send-otp");
if(sendOtp){
  sendOtp.addEventListener("click",async()=>{
    const error=q("auth-error");error.textContent="";
    const email=q("signup-email");
    if(!email.checkValidity()){email.reportValidity();return}
    sendOtp.disabled=true;sendOtp.textContent="발송 중…";
    try{
      const result=await api("/auth/signup/start",{method:"POST",body:JSON.stringify({email:email.value.trim()})});
      signupChallenge=result.challengeId;
      q("signup-otp").disabled=false;
      q("signup-otp-status").textContent="인증번호를 발송했습니다. 5분 안에 입력해 주세요.";
      sendOtp.textContent="재발송";
    }catch(err){error.textContent=err.message;sendOtp.textContent="인증번호 발송"}
    finally{sendOtp.disabled=false}
  });
}
const signupForm=q("signup-form");
if(signupForm){
  signupForm.addEventListener("submit",async(e)=>{
    e.preventDefault();
    const error=q("auth-error");error.textContent="";
    if(!signupChallenge){error.textContent="이메일 인증번호를 먼저 발송해 주세요.";return}
    if(q("signup-password").value!==q("signup-password-confirm").value){error.textContent="비밀번호 확인이 일치하지 않습니다.";return}
    const button=q("signup-button");button.disabled=true;button.textContent="가입 처리 중…";
    try{
      await api("/auth/signup/complete",{method:"POST",body:JSON.stringify({
        challengeId:signupChallenge,email:q("signup-email").value.trim(),code:q("signup-otp").value.trim(),
        fullName:q("signup-name").value.trim(),phone:q("signup-phone").value.trim(),
        businessName:q("signup-business").value.trim(),password:q("signup-password").value,
        termsAccepted:q("signup-terms").checked,privacyAccepted:q("signup-privacy").checked,
        marketingEmail:q("signup-marketing-email").checked,marketingSms:q("signup-marketing-sms").checked
      })});
      q("signup-form").hidden=true;q("signup-complete").hidden=false;
    }catch(err){error.textContent=err.message}
    finally{button.disabled=false;button.textContent="회원가입"}
  });
}
