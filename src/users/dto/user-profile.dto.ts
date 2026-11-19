export class UserProfileDto {
  id!: string;
  email!: string;
  username!: string;
  avatarUrl!: string | null;
  subscriptionActive!: boolean;
  subscriptionCancelAtPeriodEnd!: boolean;
  subscriptionCurrentPeriodEnd!: string | null;
}
