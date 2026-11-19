export const STRIPE_VALUES = {
  SUBSCRIPTION: 'subscription',
  CHECKOUT_COMPLETE: 'complete',
  TEST_SECRET_PREFIX: 'sk_test_',
  CHECKOUT_SESSION_ID: '{CHECKOUT_SESSION_ID}',
  BILLING_SUCCESS_PATH: '/billing/success',
  BILLING_CANCELED_PATH: '/billing/canceled',
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
} as const;

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  UNPAID: 'unpaid',
  PAUSED: 'paused',
  INACTIVE: 'inactive',
} as const;

export const OPEN_SUBSCRIPTION_STATUSES = new Set<string>([
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.TRIALING,
  SUBSCRIPTION_STATUS.PAST_DUE,
  SUBSCRIPTION_STATUS.UNPAID,
  SUBSCRIPTION_STATUS.PAUSED,
]);
