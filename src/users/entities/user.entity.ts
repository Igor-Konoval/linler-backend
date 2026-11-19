import { UserSessionEntity } from 'src/auth/entities/user-session.entity';
import { SUBSCRIPTION_STATUS } from 'src/constants/stripe.constants';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 120,
  })
  username!: string;

  @Column({
    name: 'avatar_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  avatarUrl!: string | null;

  @Column({
    name: 'stripe_customer_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeCustomerId!: string | null;

  @Column({
    name: 'stripe_subscription_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeSubscriptionId!: string | null;

  @Column({
    name: 'subscription_status',
    type: 'varchar',
    length: 32,
    default: SUBSCRIPTION_STATUS.INACTIVE,
  })
  subscriptionStatus!: string;

  @Column({
    name: 'subscription_cancel_at_period_end',
    type: 'boolean',
    default: false,
  })
  subscriptionCancelAtPeriodEnd!: boolean;

  @Column({
    name: 'subscription_current_period_end',
    type: 'timestamptz',
    nullable: true,
  })
  subscriptionCurrentPeriodEnd!: Date | null;

  @OneToMany(() => UserSessionEntity, (session) => session.user)
  sessions!: UserSessionEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
