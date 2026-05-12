export const Topics = {
  // Commands
  CMD_USER_REGISTER: 'cmd.user.register',
  CMD_PAYMENT_TRANSFER_CREATE: 'cmd.payment.transfer.create',
  CMD_WALLET_RESERVE: 'cmd.wallet.reserve',
  CMD_WALLET_CREDIT: 'cmd.wallet.credit',
  CMD_WALLET_COMMIT: 'cmd.wallet.commit',
  CMD_WALLET_RELEASE: 'cmd.wallet.release',
  CMD_WALLET_REFILL: 'cmd.wallet.refill',

  // Events
  EVT_USER_CREATED: 'evt.user.created',
  EVT_WALLET_CREATED: 'evt.wallet.created',
  EVT_WALLET_RESERVED: 'evt.wallet.reserved',
  EVT_WALLET_RESERVE_FAILED: 'evt.wallet.reserve.failed',
  EVT_WALLET_CREDITED: 'evt.wallet.credited',
  EVT_WALLET_CREDIT_FAILED: 'evt.wallet.credit.failed',
  EVT_WALLET_COMMITTED: 'evt.wallet.committed',
  EVT_WALLET_COMMIT_FAILED: 'evt.wallet.commit.failed',
  EVT_WALLET_RELEASED: 'evt.wallet.released',
  EVT_PAYMENT_COMPLETED: 'evt.payment.completed',
  EVT_PAYMENT_FAILED: 'evt.payment.failed',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];

export const ALL_TOPICS = Object.values(Topics);

export const COMMAND_TOPICS = ALL_TOPICS.filter((t) => t.startsWith('cmd.'));
export const EVENT_TOPICS = ALL_TOPICS.filter((t) => t.startsWith('evt.'));
