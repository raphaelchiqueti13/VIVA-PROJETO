import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendDonationConfirmedEmail } from "./mail.js";

const originalFetch = globalThis.fetch;
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL
};

test("sendEmail recusa envio sem configuração e não tenta chamar o provedor", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("não deveria chamar"); };
  await assert.rejects(sendEmail({ to: "teste@example.com", subject: "Teste", html: "", text: "" }), { code: "EMAIL_NOT_CONFIGURED" });
  assert.equal(called, false);
});

test("sendEmail envia pela API oficial usando bearer e trata sucesso confirmado", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "VIVA+ <no-reply@example.com>";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: "email_test_123" }) };
  };
  const result = await sendEmail({ to: "doador@example.com", subject: "Teste", html: "<p>ok</p>", text: "ok", idempotencyKey: "test-123" });
  assert.deepEqual(result, { id: "email_test_123" });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.Authorization, "Bearer re_test_key");
  assert.equal(request.options.headers["Idempotency-Key"], "test-123");
  assert.deepEqual(JSON.parse(request.options.body).to, ["doador@example.com"]);
});

test("sendEmail não trata resposta negativa como envio bem-sucedido", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "VIVA+ <no-reply@example.com>";
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: "domain not verified" }) });
  await assert.rejects(sendEmail({ to: "doador@example.com", subject: "Teste", html: "", text: "" }), { code: "EMAIL_PROVIDER_ERROR", status: 403 });
});

test("template de redefinição escapa caracteres do nome e envia URL de ação", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "VIVA+ <no-reply@example.com>";
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ id: "email_test_456" }) };
  };
  await sendPasswordResetEmail({ to: "doador@example.com", name: "<script>alert(1)</script>", resetUrl: "https://viva.example/?reset=secret", idempotencyKey: "reset-456" });
  assert.match(body.html, /&lt;script&gt;/);
  assert.doesNotMatch(body.html, /<script>alert/);
  assert.match(body.text, /https:\/\/viva\.example/);
});

test("modelos de segurança e doação usam texto e conteúdo contextual", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "VIVA+ <no-reply@example.com>";
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ id: `email_${bodies.length}` }) };
  };
  await sendPasswordChangedEmail({ to: "doador@example.com", name: "Ana", idempotencyKey: "changed-1" });
  await sendDonationConfirmedEmail({ to: "doador@example.com", name: "Ana", donationDate: "2026-11-13", hemocenter: "Unidade Centro", idempotencyKey: "donation-1" });
  assert.match(bodies[0].subject, /segurança/i);
  assert.match(bodies[0].text, /sessões foram encerradas/i);
  assert.match(bodies[1].html, /Unidade Centro/);
  assert.match(bodies[1].text, /2026-11-13/);
});

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
