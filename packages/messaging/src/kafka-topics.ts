export const Topics = {
  // Commands
  CMD_USER_REGISTER: 'cmd.user.register',
  CMD_PAYMENT_TRANSFER_CREATE: 'cmd.payment.transfer.create',
  CMD_WALLET_TRANSFER: 'cmd.wallet.transfer',
  CMD_WALLET_REFILL: 'cmd.wallet.refill',

  // Events
  EVT_USER_CREATED: 'evt.user.created',
  EVT_WALLET_CREATED: 'evt.wallet.created',
  EVT_WALLET_DEBITED: 'evt.wallet.debited',
  EVT_WALLET_CREDITED: 'evt.wallet.credited',
  EVT_PAYMENT_CREATED: 'evt.payment.created',
  EVT_PAYMENT_COMPLETED: 'evt.payment.completed',
  EVT_PAYMENT_FAILED: 'evt.payment.failed',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];

export const ALL_TOPICS = Object.values(Topics);

export const COMMAND_TOPICS = ALL_TOPICS.filter((t) => t.startsWith('cmd.'));
export const EVENT_TOPICS = ALL_TOPICS.filter((t) => t.startsWith('evt.'));
