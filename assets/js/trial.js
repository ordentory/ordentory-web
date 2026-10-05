// Verified trial: the email is confirmed BEFORE a license is created.
const TRIAL_API = "https://api.ordentory.kr/v1/store/trials";
const TRIAL_START_API = TRIAL_API + "/email/start";
const OFFICIAL_INSTALLER = "https://api.ordentory.kr/v1/store/installer";
const trialState = { email:"", challengeId:"", expiresAt:0, resendAfter:0, finished:false };
const trialEmail = document.getElementById("trial-email");
const startButton = document.getElementById("start-trial-email");
const issueButton = document.getElementById("issue-trial");
const resendButton = document.getElementById("trial-resend");
const errorBox = document.getElementById("trial-error");
const emailStep = document.getElementById("trial-email-step");
const otpStep = document.getElementById("trial-otp-step");
const resultStep = document.getElementById("trial-result");
const otpInput = document.getElementById("trial-otp");
const challengePattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const licensePattern=/^ORD-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/;

function trialError(message) { errorBox.textContent = message || ""; }

function trialStage(number) {
  for (const [i,id] of ["trial-stage-email","trial-stage-otp","trial-stage-issued"].entries()) {
    document.getElementById(id).classList.toggle("current", i === number);
    document.getElementById(id).classList.toggle("done", i < number);
  }
}

function validOfficialInstaller(value){
  try{
    const u=new URL(String(value||""));
    return u.protocol==="https:" &&
      u.hostname==="api.ordentory.kr" &&
      u.port==="" &&
      u.pathname==="/v1/store/installer" &&
      u.search==="" &&
      u.hash==="" &&
      !u.username&&!u.password;
  }catch{return false;}
}

async function trialRequest(url, payload) {
  const response = await fetch(url, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload),
    credentials:"omit",
    cache:"no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || body?.message || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    error.code = body?.error?.code || "";
    throw error;
  }
  return body;
}

function updateTrialCountdown() {
  if (otpStep.hidden || trialState.finished) return;
  const remaining = Math.max(0, Math.ceil((trialState.expiresAt - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  document.getElementById("trial-otp-expiry").textContent =
    remaining ? `남은 인증시간: ${minutes}분 ${String(remaining % 60).padStart(2,"0")}초` :
    "인증번호가 만료되었습니다. 아래에서 재발송해 주세요.";
  const resendSeconds = Math.max(0, Math.ceil((trialState.resendAfter - Date.now()) / 1000));
  resendButton.disabled = resendSeconds > 0;
  resendButton.textContent = resendSeconds ? `인증번호 재발송 (${resendSeconds}초)` : "인증번호 재발송";
}

async function requestTrialEmail() {
  trialError("");
  if (!trialEmail.value.trim() || !trialEmail.checkValidity()) {
    trialEmail.reportValidity(); return;
  }
  if (!document.getElementById("trial-policy-consent").checked) {
    trialError("개인정보처리방침을 확인하고 이메일 처리에 동의해 주세요."); return;
  }

  const currentEmail = trialEmail.value.trim().toLowerCase();
  startButton.disabled = true;
  resendButton.disabled = true;
  startButton.textContent = "인증 메일 발송 중…";
  resendButton.textContent = "인증 메일 발송 중…";

  try {
    const result = await trialRequest(TRIAL_START_API, { email:currentEmail });
    const expiresAt = new Date(result.expiresAt).getTime();
    if (!challengePattern.test(String(result.challengeId||"")) ||
        !Number.isFinite(expiresAt) ||
        expiresAt<=Date.now() ||
        result.verificationSent!==true) {
      throw new Error("인증 요청 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
    }

    trialState.email = currentEmail;
    trialState.challengeId = result.challengeId;
    trialState.expiresAt = expiresAt;
    trialState.resendAfter = Date.now() + 60_000;
    trialState.finished = false;

    otpInput.value = "";
    document.getElementById("trial-otp-email").textContent = currentEmail;
    emailStep.hidden = true;
    otpStep.hidden = false;
    trialStage(1);
    updateTrialCountdown();
    otpInput.focus();
  } catch (error) {
    if (error.code === "TRIAL_EMAIL_COOLDOWN" || error.code === "PUBLIC_TRIAL_RATE_LIMITED") {
      trialState.resendAfter = Date.now() + (error.code === "PUBLIC_TRIAL_RATE_LIMITED" ? 3600_000 : 60_000);
    }
    trialError(error?.message || "인증 메일 발송 중 오류가 발생했습니다.");
  } finally {
    startButton.disabled = false;
    startButton.textContent = "인증번호 이메일로 받기";
    updateTrialCountdown();
  }
}

function validateIssuedTrial(result){
  if (!result || result.email!==trialState.email) return false;
  if (!licensePattern.test(String(result.licenseCode||""))) return false;
  if (Number(result.trialDays)!==7 || Number(result.deviceLimit)!==1) return false;
  if (result.emailDelivery!=="queued") return false;
  if (!validOfficialInstaller(result.installerUrl)) return false;
  return true;
}

async function issueVerifiedTrial() {
  trialError("");
  if (!trialState.challengeId || !trialState.email) {
    trialError("먼저 이메일 인증을 요청해 주세요."); return;
  }
  if (Date.now() >= trialState.expiresAt) {
    trialError("인증번호가 만료되었습니다. 인증번호를 재발송해 주세요."); return;
  }

  const code = otpInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    trialError("이메일로 받은 6자리 숫자를 입력해 주세요.");
    otpInput.focus();
    return;
  }

  issueButton.disabled = true;
  issueButton.textContent = "인증 확인 및 무료체험 발급 중…";

  try {
    const result = await trialRequest(TRIAL_API, {
      email:trialState.email,
      challengeId:trialState.challengeId,
      code
    });

    if (!validateIssuedTrial(result)) {
      throw new Error("무료체험 발급 응답을 확인하지 못했습니다. 재신청하지 말고 고객지원에 문의해 주세요.");
    }

    trialState.finished = true;
    document.getElementById("trial-code").textContent = result.licenseCode;
    document.getElementById("trial-installer").href = OFFICIAL_INSTALLER;
    document.getElementById("trial-result-email").textContent = trialState.email;
    document.getElementById("trial-email-notice").textContent =
      `${trialState.email} 주소로 같은 라이선스 코드와 공식 다운로드 링크를 발송 대기 중입니다. 메일을 기다리지 않고 아래에서 바로 설치할 수도 있습니다.`;

    document.getElementById("trial-form").hidden = true;
    resultStep.hidden = false;
    trialStage(2);
    resultStep.scrollIntoView({behavior:"smooth",block:"start"});
  } catch (error) {
    trialError(error?.message || "이메일 인증 또는 무료체험 발급에 실패했습니다.");
    if (error.code === "TRIAL_OTP_EXPIRED") trialState.expiresAt = 0;
    if (error.code === "TRIAL_OTP_INVALID") otpInput.select();
  } finally {
    issueButton.disabled = false;
    issueButton.textContent = "이메일 확인 및 7일 무료체험 발급";
  }
}

startButton.addEventListener("click", requestTrialEmail);
issueButton.addEventListener("click", issueVerifiedTrial);
trialEmail.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); requestTrialEmail(); }
});
otpInput.addEventListener("input", () => {
  otpInput.value = otpInput.value.replace(/\D/g,"").slice(0,6);
});
otpInput.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); issueVerifiedTrial(); }
});

resendButton.addEventListener("click", () => {
  if (Date.now() < trialState.resendAfter) return;
  requestTrialEmail();
});

document.getElementById("trial-change-email").addEventListener("click", () => {
  trialError("");
  trialState.email = "";
  trialState.challengeId = "";
  trialState.expiresAt = 0;
  trialState.resendAfter = 0;
  trialState.finished = false;
  otpInput.value = "";
  otpStep.hidden = true;
  emailStep.hidden = false;
  trialStage(0);
  trialEmail.focus();
});

document.getElementById("copy-trial").addEventListener("click", async event => {
  const code = document.getElementById("trial-code").textContent.trim();
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    const button = event.currentTarget;
    button.textContent = "복사됨";
    setTimeout(() => button.textContent = "무료체험 코드 복사", 1500);
  } catch (_) {
    document.getElementById("trial-email-notice").textContent =
      "자동 복사가 허용되지 않았습니다. 위 코드를 직접 복사해 주세요. 인증된 이메일로도 같은 코드와 공식 다운로드 링크를 발송합니다.";
  }
});

setInterval(updateTrialCountdown,1000);
