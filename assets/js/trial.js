const TRIAL_API="https://api.ordentory.kr/v1/store/trials";
const email=document.getElementById("trial-email");
const issue=document.getElementById("issue-trial");
const errorBox=document.getElementById("trial-error");
const formView=document.getElementById("trial-form");
const resultView=document.getElementById("trial-result");

async function issueTrial(){
  errorBox.textContent="";
  if(!email.value.trim()||!email.checkValidity()){
    email.reportValidity();
    return;
  }
  issue.disabled=true;
  issue.textContent="Trial 발급 중…";
  try{
    const response=await fetch(TRIAL_API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email:email.value.trim()})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body?.error?.message||body?.message||"무료체험을 발급하지 못했습니다.");
    document.getElementById("trial-code").textContent=body.licenseCode||"";
    if(body.installerUrl)document.getElementById("trial-installer").href=body.installerUrl;
    formView.hidden=true;
    resultView.hidden=false;
  }catch(error){
    errorBox.textContent=error?.message||"무료체험 발급 중 오류가 발생했습니다.";
  }finally{
    issue.disabled=false;
    issue.textContent="7일 무료체험 시작";
  }
}

issue.addEventListener("click",issueTrial);
email.addEventListener("keydown",e=>{if(e.key==="Enter")issueTrial()});
document.getElementById("copy-trial").addEventListener("click",async e=>{
  const code=document.getElementById("trial-code").textContent.trim();
  if(!code)return;
  try{
    await navigator.clipboard.writeText(code);
    const prev=e.currentTarget.textContent;
    e.currentTarget.textContent="복사됨";
    setTimeout(()=>e.currentTarget.textContent=prev,1200);
  }catch{}
});
