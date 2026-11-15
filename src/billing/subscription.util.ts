import { SUBSCRIPTION_STATUS } from 'src/constants/stripe.constants';

export function isSubscriptionActive(user: {
  subscriptionStatus?: string | null;
  subscriptionCurrentPeriodEnd?: Date | string | null;
}): boolean {
  const status = user.subscriptionStatus ?? SUBSCRIPTION_STATUS.INACTIVE;

  if (
    status !== SUBSCRIPTION_STATUS.ACTIVE &&
    status !== SUBSCRIPTION_STATUS.TRIALING
  ) {
    return false;
  }

  if (!user.subscriptionCurrentPeriodEnd) {
    return true;
  }

  return new Date(user.subscriptionCurrentPeriodEnd).getTime() > Date.now();
}

export function toSubscriptionState(user: {
  subscriptionStatus?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean | null;
  subscriptionCurrentPeriodEnd?: Date | string | null;
}): {
  subscriptionActive: boolean;
  subscriptionCancelAtPeriodEnd: boolean;
  subscriptionCurrentPeriodEnd: string | null;
} {
  return {
    subscriptionActive: isSubscriptionActive(user),
    subscriptionCancelAtPeriodEnd: Boolean(user.subscriptionCancelAtPeriodEnd),
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd
      ? new Date(user.subscriptionCurrentPeriodEnd).toISOString()
      : null,
  };
}
