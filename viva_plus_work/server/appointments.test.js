import test from "node:test";
import assert from "node:assert/strict";
import { APPOINTMENT_TIMES, buildAppointmentSlots, isAllowedAppointmentTime } from "./appointments.js";

test("lista somente os horários de atendimento publicados pelo VIVA+", () => {
  assert.equal(APPOINTMENT_TIMES.length, 12);
  assert.equal(isAllowedAppointmentTime("09:00"), true);
  assert.equal(isAllowedAppointmentTime("09:15"), false);
});

test("horários já ocupados aparecem como indisponíveis", () => {
  const slots = buildAppointmentSlots({
    date: "2026-11-16", bookedTimes: ["09:00", "13:30"],
    today: "2026-11-13", currentTime: "18:00"
  });
  assert.equal(slots.find(slot => slot.time === "09:00").available, false);
  assert.equal(slots.find(slot => slot.time === "13:30").reason, "booked");
  assert.equal(slots.find(slot => slot.time === "09:30").available, true);
});

test("horários passados não aparecem como disponíveis no mesmo dia", () => {
  const slots = buildAppointmentSlots({
    date: "2026-11-13", bookedTimes: [],
    today: "2026-11-13", currentTime: "09:15"
  });
  assert.equal(slots.find(slot => slot.time === "09:00").available, false);
  assert.equal(slots.find(slot => slot.time === "09:30").available, true);
});

test("todos os horários do dia ficam indisponíveis quando a data já passou", () => {
  const slots = buildAppointmentSlots({
    date: "2026-11-12", bookedTimes: [],
    today: "2026-11-13", currentTime: "09:00"
  });
  assert.equal(slots.some(slot => slot.available), false);
});
