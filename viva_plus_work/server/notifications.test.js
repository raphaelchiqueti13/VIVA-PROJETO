import test from "node:test";
import assert from "node:assert/strict";
import { insertNotification, notifyCampaignSubscribers } from "./notifications.js";

function fakeDb(users = []) {
  const notifications = [];
  const unique = new Set();
  return {
    notifications,
    prepare(sql) {
      if (sql.includes("SELECT id, region, blood_type") && sql.includes("FROM users")) {
        return { all: () => users.filter(user => user.role === "donor" && user.active === 1 && user.notification_campaigns === 1) };
      }
      if (sql.includes("INSERT OR IGNORE INTO notifications")) {
        return { run: (userId,type,title,message,target,referenceId,dedupeKey) => {
          const key = `${userId}:${dedupeKey}`;
          if (unique.has(key)) return { changes: 0 };
          unique.add(key);
          notifications.push({ id: notifications.length + 1, user_id: userId, type, title, message, target, reference_id: referenceId, dedupe_key: dedupeKey });
          return { changes: 1 };
        } };
      }
      throw new Error(`Consulta não prevista no fakeDb: ${sql}`);
    }
  };
}

test("notificação é persistida uma única vez para o mesmo evento", () => {
  const db = fakeDb([{ id: 1, role: "donor", active: 1, notification_campaigns: 1 }]);
  const item = {
    userId: 1, type: "donation", title: "Doação concluída!", message: "Registro confirmado.",
    target: "carteira", referenceId: 10, dedupeKey: "donation:10:validated"
  };
  assert.equal(insertNotification(db, item), 1);
  assert.equal(insertNotification(db, item), 0);
  assert.equal(db.notifications[0].type, "donation");
  assert.equal(db.notifications[0].target, "carteira");
  assert.equal(db.notifications[0].reference_id, 10);
});

test("campanha por região e tipo notifica somente doadores ativos inscritos e compatíveis", () => {
  const users = [
    { id: 1, role: "donor", active: 1, notification_campaigns: 1, region: "Centro", blood_type: "O-" },
    { id: 2, role: "donor", active: 1, notification_campaigns: 1, region: "Zona Sul", blood_type: "O-" },
    { id: 3, role: "donor", active: 1, notification_campaigns: 0, region: "Centro", blood_type: "O-" },
    { id: 4, role: "donor", active: 0, notification_campaigns: 1, region: "Centro", blood_type: "O-" },
    { id: 5, role: "donor", active: 1, notification_campaigns: 1, region: "Centro", blood_type: "A+" },
    { id: 6, role: "admin", active: 1, notification_campaigns: 1, region: "Centro", blood_type: "O-" }
  ];
  const db = fakeDb(users);
  const count = notifyCampaignSubscribers(db, {
    id: 55, title: "Campanha O- Centro", region: "Centro", blood_type: "O-",
    start_date: "2026-11-13", end_date: "2026-11-30"
  });
  assert.equal(count, 1);
  assert.deepEqual(db.notifications.map(row => row.user_id), [1]);
  assert.equal(notifyCampaignSubscribers(db, {
    id: 56, title: "Campanha nacional", region: "Nacional", blood_type: null,
    start_date: "2026-11-13", end_date: "2026-11-30"
  }), 3);
});

test("notificação rejeita destinos e tipos não permitidos", () => {
  const db = fakeDb();
  assert.throws(() => insertNotification(db, {
    userId: 1, type: "donation", title: "Teste", message: "Teste", target: "https://example.com", dedupeKey: "x"
  }), /Destino de notificação inválido/);
  assert.throws(() => insertNotification(db, {
    userId: 1, type: "unknown", title: "Teste", message: "Teste", target: "carteira", dedupeKey: "y"
  }), /Tipo de notificação inválido/);
});
