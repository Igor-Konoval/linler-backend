export class SubscriptionStateDto {
  subscriptionActive!: boolean;
  subscriptionCancelAtPeriodEnd!: boolean;
  subscriptionCurrentPeriodEnd!: string | null;
}
