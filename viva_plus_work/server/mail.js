const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    const error = new Error("Serviço de e-mail não configurado.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) {
    const error = new Error("O provedor de e-mail não confirmou o envio.");
    error.code = "EMAIL_PROVIDER_ERROR";
    error.status = response.status;
    throw error;
  }
  return { id: result.id };
}

function emailLayout({ title, greeting, content, actionUrl, actionLabel, footer }) {
  const safeTitle = escapeHtml(title);
  const safeGreeting = escapeHtml(greeting);
  const safeFooter = escapeHtml(footer || "VIVA+ · Plataforma de incentivo à doação voluntária.");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f3f4;font-family:Arial,Helvetica,sans-serif;color:#30272a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #eadfe2;border-radius:18px;overflow:hidden"><tr><td style="padding:26px 32px;background:#8e1425;color:#fff"><div style="font-size:25px;font-weight:800;letter-spacing:-1px">VIVA<span style="color:#ffcad3">+</span></div><div style="margin-top:5px;font-size:11px;letter-spacing:1.5px;opacity:.86">CARTEIRA NACIONAL DO DOADOR</div></td></tr><tr><td style="padding:34px 32px"><h1 style="margin:0 0 18px;font-size:23px;color:#38272c">${safeTitle}</h1><p style="font-size:15px;line-height:1.65;margin:0 0 16px">Olá, ${safeGreeting}.</p><div style="font-size:14px;line-height:1.7;color:#62565a">${content}</div>${actionUrl ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#a51c35;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">${escapeHtml(actionLabel)}</a></p><p style="font-size:12px;line-height:1.6;color:#786b70;word-break:break-all">Se o botão não funcionar, copie este endereço:<br>${escapeHtml(actionUrl)}</p>` : ""}</td></tr><tr><td style="padding:20px 32px;background:#faf7f8;border-top:1px solid #eee5e7;color:#8b7a7f;font-size:11px;line-height:1.6">${safeFooter}<br>Se você não reconhece esta solicitação, ignore este e-mail e proteja sua conta.</td></tr></table></td></tr></table></body></html>`;
}

export async function sendPasswordResetEmail({ to, name, resetUrl, idempotencyKey }) {
  const greeting = name || "pessoa doadora";
  const html = emailLayout({
    title: "Redefina sua senha",
    greeting,
    content: "Recebemos uma solicitação para redefinir a senha da sua conta VIVA+. O link é válido por 30 minutos e só pode ser utilizado uma vez. Se você não solicitou a redefinição, nenhuma ação é necessária.",
    actionUrl: resetUrl,
    actionLabel: "Criar nova senha"
  });
  const text = `Olá, ${greeting}. Recebemos uma solicitação para redefinir sua senha VIVA+. Acesse ${resetUrl}. O link expira em 30 minutos e só pode ser usado uma vez. Se você não solicitou, ignore esta mensagem.`;
  return sendEmail({ to, subject: "Redefinição de senha — VIVA+", html, text, idempotencyKey });
}

export async function sendPasswordChangedEmail({ to, name, idempotencyKey }) {
  const greeting = name || "pessoa doadora";
  const html = emailLayout({
    title: "Sua senha foi alterada",
    greeting,
    content: "A senha da sua conta VIVA+ foi alterada com sucesso. As outras sessões foram encerradas. Se você não reconhece essa alteração, solicite uma nova redefinição de senha e entre em contato com a equipe responsável pela plataforma."
  });
  const text = `Olá, ${greeting}. A senha da sua conta VIVA+ foi alterada. As demais sessões foram encerradas. Se você não reconhece essa alteração, redefina a senha imediatamente.`;
  return sendEmail({ to, subject: "Alerta de segurança — senha alterada no VIVA+", html, text, idempotencyKey });
}

export async function sendDonationConfirmedEmail({ to, name, donationDate, hemocenter, idempotencyKey }) {
  const greeting = name || "pessoa doadora";
  const safeDate = escapeHtml(donationDate || "data registrada");
  const safeCenter = escapeHtml(hemocenter || "unidade de atendimento");
  const html = emailLayout({
    title: "Doação registrada no VIVA+",
    greeting,
    content: `A unidade registrou uma doação realizada em <strong>${safeDate}</strong>, em ${safeCenter}. O histórico e a contagem de selos da sua carteira foram atualizados. Este aviso confirma somente o registro no VIVA+ e não substitui comprovantes ou registros oficiais do hemocentro.`
  });
  const text = `Olá, ${greeting}. Uma doação realizada em ${donationDate} foi registrada no VIVA+ por ${hemocenter}. Seu histórico e a contagem de selos foram atualizados. Este aviso confirma apenas o registro no VIVA+ e não substitui comprovantes oficiais.`;
  return sendEmail({ to, subject: "Doação registrada — VIVA+", html, text, idempotencyKey });
}
