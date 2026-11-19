/** Regras de disponibilidade dos horários internos do VIVA+. */
export const APPOINTMENT_TIMES = Object.freeze([
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "13:00", "13:30", "14:00", "14:30", "15:00"
]);

export function isAllowedAppointmentTime(value) {
  return APPOINTMENT_TIMES.includes(String(value || ""));
}

/**
 * Cada horário tem uma vaga por unidade. A reserva é interna ao VIVA+.
 * Horários passados não são exibidos como disponíveis para o dia atual.
 */
export function buildAppointmentSlots({ date, bookedTimes = [], today, currentTime }) {
  const booked = new Set(bookedTimes.map(value => String(value).slice(0, 5)));
  return APPOINTMENT_TIMES.map(time => {
    const isPast = date < today || (date === today && time <= currentTime);
    const isBooked = booked.has(time);
    return {
      time,
      available: !isPast && !isBooked,
      reason: isPast ? "past" : isBooked ? "booked" : null
    };
  });
}
