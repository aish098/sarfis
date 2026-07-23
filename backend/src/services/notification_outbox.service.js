const db = require('../config/db');
const NotificationService = require('./notification.service');

class NotificationOutboxService {
  /**
   * Enqueues a notification event inside an active database transaction
   */
  static async enqueueNotification({
    companyId,
    eventType,
    aggregateType,
    aggregateId,
    payload,
    trx = db
  }) {
    const queryExecutor = trx || db;
    await queryExecutor('notification_outbox').insert({
      company_id: companyId,
      event_type: eventType,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      payload_json: JSON.stringify(payload || {}),
      status: 'PENDING'
    });
  }

  /**
   * Worker method to process pending outbox events (locking rows to prevent duplicate sends)
   */
  static async processOutbox() {
    try {
      await db.transaction(async (trx) => {
        // Select pending outbox messages with lock
        const pendingEvents = await trx('notification_outbox')
          .where({ status: 'PENDING' })
          .orderBy('id', 'asc')
          .limit(10)
          .forUpdate();

        if (pendingEvents.length === 0) return;

        const eventIds = pendingEvents.map(e => e.id);
        await trx('notification_outbox')
          .whereIn('id', eventIds)
          .update({ status: 'PROCESSING', locked_at: trx.fn.now() });

        for (const event of pendingEvents) {
          try {
            const payload = typeof event.payload_json === 'string' ? JSON.parse(event.payload_json) : event.payload_json;
            if (payload.userIds && Array.isArray(payload.userIds) && payload.userIds.length > 0) {
              await NotificationService.notifyDirect({
                companyId: event.company_id,
                userIds: payload.userIds,
                title: payload.title || `Workflow Event: ${event.event_type}`,
                message: payload.message || '',
                type: payload.type || 'approval',
                priority: payload.priority || 'HIGH',
                entityType: event.aggregate_type,
                entityId: event.aggregate_id
              });
            }
            await trx('notification_outbox').where({ id: event.id }).update({ status: 'SENT' });
          } catch (err) {
            console.error(`[NOTIFICATION OUTBOX ERROR] Event ID ${event.id}:`, err);
            await trx('notification_outbox').where({ id: event.id }).update({ status: 'FAILED' });
          }
        }
      });
    } catch (err) {
      console.error('[NOTIFICATION OUTBOX PROCESS ERROR]:', err);
    }
  }
}

module.exports = NotificationOutboxService;
