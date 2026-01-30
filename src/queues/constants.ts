export const QUEUES = {
  // Messages
  MESSAGE_SEND: 'messages.send',
  MESSAGE_EDIT: 'messages.edit',
  MESSAGE_DELETE: 'messages.delete',

  // Notifications
  NOTIFICATION_PUSH: 'notifications.push',

  // Documents
  DOCUMENT_REMINDER: 'documents.reminder',
};

export const EXCHANGES = {
  MESSAGES: 'messages.exchange',
  NOTIFICATIONS: 'notifications.exchange',
  DOCUMENTS: 'documents.exchange',
};

export const ROUTING_KEYS = {
  MESSAGE_NEW: 'message.new',
  MESSAGE_EDITED: 'message.edited',
  MESSAGE_DELETED: 'message.deleted',
  NOTIFICATION_NEW: 'notification.new',
  DOCUMENT_PENDING: 'document.pending',
};
