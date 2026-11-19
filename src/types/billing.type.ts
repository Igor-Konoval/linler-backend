export interface UpdateUserBilling {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string;
  subscriptionCancelAtPeriodEnd?: boolean;
  subscriptionCurrentPeriodEnd?: Date | null;
}
