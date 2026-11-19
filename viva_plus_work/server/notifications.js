/** Persistência e distribuição de notificações internas do VIVA+. */
export function insertNotification(db, {
  userId,
  type,
  title,
  message,
  target,
  referenceId = null,
  dedupeKey
}) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1) return 0;
  if (!['donation', 'campaign', 'appointment', 'system'].includes(type)) {
    throw new Error('Tipo de notificação inválido.');
  }
  if (!['carteira', 'campanhas', 'agendamentos', 'inicio'].includes(target)) {
    throw new Error('Destino de notificação inválido.');
  }
  const result = db.prepare(`
    INSERT OR IGNORE INTO notifications
      (user_id, type, title, message, target, reference_id, dedupe_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(Number(userId), type, String(title).slice(0, 120), String(message).slice(0, 500), target, referenceId, dedupeKey);
  return result.changes;
}

/** Notifica apenas doadores ativos que aceitaram avisos e correspondem ao público. */
export function notifyCampaignSubscribers(db, campaign) {
  const donors = db.prepare(`
    SELECT id, region, blood_type
    FROM users
    WHERE role='donor' AND active=1 AND notification_campaigns=1
  `).all();
  const campaignRegion = String(campaign.region || '').trim().toLocaleLowerCase('pt-BR');
  const campaignBlood = String(campaign.blood_type ?? campaign.bloodType ?? '').trim().toUpperCase();
  let created = 0;
  for (const donor of donors) {
    const donorRegion = String(donor.region || '').trim().toLocaleLowerCase('pt-BR');
    const regionMatches = !campaignRegion || campaignRegion === 'nacional' || donorRegion === campaignRegion;
    const bloodMatches = !campaignBlood || String(donor.blood_type || '').toUpperCase() === campaignBlood;
    if (!regionMatches || !bloodMatches) continue;
    created += insertNotification(db, {
      userId: donor.id,
      type: 'campaign',
      title: 'Nova campanha disponível',
      message: `A campanha “${campaign.title}” foi publicada no VIVA+. Confira os detalhes e o período de participação.`,
      target: 'campanhas',
      referenceId: campaign.id,
      dedupeKey: `campaign:${campaign.id}:published:${campaign.start_date || campaign.startDate}:${campaign.end_date || campaign.endDate}`
    });
  }
  return created;
}
