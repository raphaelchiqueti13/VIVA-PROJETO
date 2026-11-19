import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

test("o sino abre a página própria de notificações", () => {
  assert.match(source, /onClick=\{\(\)=>\{go\(\"notificacoes\"\);refreshNotifications\(\);\}\}/);
  assert.match(source, /page===\"notificacoes\" && <NotificationsPage/);
  assert.match(source, /id:\"notificacoes\", label:\"Notificações\"/);
});

test("marcar uma notificação como lida não redireciona para outra área", () => {
  const start = source.indexOf("async function openNotification(item)");
  assert.notEqual(start, -1, "handler de leitura precisa existir");
  const end = source.indexOf("async function refreshNotifications()", start);
  const handler = source.slice(start, end);
  assert.match(handler, /markNotificationRead\(item.id\)/);
  assert.doesNotMatch(handler, /go\(|setPage\(/);
});
