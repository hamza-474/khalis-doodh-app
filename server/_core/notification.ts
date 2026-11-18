// Local owner-notification stub (replaces the Manus Forge notification
// service). Marketplace events are already recorded as rows in
// marketplace_notifications; this only logs for the server console until a
// real channel (SMS/WhatsApp/email) is connected.
export async function notifyOwner(payload: {
  title: string;
  content: string;
}): Promise<boolean> {
  console.log(`[Owner notification] ${payload.title}: ${payload.content}`);
  return true;
}
