import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { ENV_VARIABLES } from 'src/constants/env.constants';
import {
  OPEN_SUBSCRIPTION_STATUSES,
  STRIPE_VALUES,
} from 'src/constants/stripe.constants';
import { UserEntity } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { SubscriptionStateDto } from './dto/subscription-state.dto';
import { isSubscriptionActive, toSubscriptionState } from './subscription.util';

@Injectable()
export class BillingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async createCheckout(userId: string): Promise<{ url: string }> {
    const stripe = this.getStripe();
    const user = await this.requireUser(userId);

    if (this.hasOpenSubscription(user)) {
      throw new BadRequestException(
        'You already have a subscription. Cancel renewal before starting another one.',
      );
    }

    const priceId = this.configService.get<string>(
      ENV_VARIABLES.STRIPE_PRICE_ID,
    );

    if (!priceId) {
      throw new BadRequestException(ERROR_MESSAGES.BILLING_NOT_CONFIGURED);
    }

    const customerId = await this.getOrCreateCustomer(stripe, user);
    const frontendUrl = this.frontendUrl();
    const session = await stripe.checkout.sessions.create({
      mode: STRIPE_VALUES.SUBSCRIPTION,
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}${STRIPE_VALUES.BILLING_SUCCESS_PATH}?session_id=${STRIPE_VALUES.CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}${STRIPE_VALUES.BILLING_CANCELED_PATH}`,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout link.');
    }

    return { url: session.url };
  }

  async confirmCheckout(
    userId: string,
    sessionId: string,
  ): Promise<SubscriptionStateDto> {
    const stripe = this.getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: [STRIPE_VALUES.SUBSCRIPTION],
    });
    const sessionUserId =
      session.metadata?.userId || session.client_reference_id;

    if (sessionUserId !== userId) {
      throw new BadRequestException(
        'This checkout session belongs to another account.',
      );
    }

    if (session.status !== STRIPE_VALUES.CHECKOUT_COMPLETE) {
      throw new BadRequestException('Checkout is not complete yet.');
    }

    const subscription = await this.resolveSubscription(
      stripe,
      session.subscription,
    );

    if (!subscription) {
      throw new BadRequestException('Stripe did not attach a subscription.');
    }

    const user = await this.applySubscription(userId, subscription);

    return toSubscriptionState(user);
  }

  async cancelRenewal(userId: string): Promise<SubscriptionStateDto> {
    const stripe = this.getStripe();
    const user = await this.requireUser(userId);

    if (!user.stripeSubscriptionId || !isSubscriptionActive(user)) {
      throw new BadRequestException(
        'There is no active subscription to cancel.',
      );
    }

    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );
    const updated = await this.applySubscription(userId, subscription);

    return toSubscriptionState(updated);
  }

  async resumeRenewal(userId: string): Promise<SubscriptionStateDto> {
    const stripe = this.getStripe();
    const user = await this.requireUser(userId);

    if (!user.stripeSubscriptionId || !isSubscriptionActive(user)) {
      throw new BadRequestException(
        'There is no active subscription to resume.',
      );
    }

    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: false },
    );
    const updated = await this.applySubscription(userId, subscription);

    return toSubscriptionState(updated);
  }

  async handleWebhook(request: Request, signature: string | undefined) {
    const stripe = this.getStripe();
    const secret = this.configService.get<string>(
      ENV_VARIABLES.STRIPE_WEBHOOK_SECRET,
    );
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;

    if (!secret || !signature || !rawBody) {
      throw new BadRequestException(ERROR_MESSAGES.BILLING_NOT_CONFIGURED);
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

    if (event.type === STRIPE_VALUES.CHECKOUT_SESSION_COMPLETED) {
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;
      const subscription = await this.resolveSubscription(
        stripe,
        session.subscription,
      );

      if (userId && subscription) {
        await this.applySubscription(userId, subscription);
      }
    }

    if (
      event.type === STRIPE_VALUES.SUBSCRIPTION_UPDATED ||
      event.type === STRIPE_VALUES.SUBSCRIPTION_DELETED
    ) {
      const subscription = event.data.object;
      const user =
        (await this.usersService.findByStripeSubscriptionId(subscription.id)) ||
        (subscription.metadata?.userId
          ? await this.usersService.findById(subscription.metadata.userId)
          : null);

      if (user) {
        await this.applySubscription(user.id, subscription);
      }
    }

    return { received: true };
  }

  private async applySubscription(
    userId: string,
    subscription: Stripe.Subscription,
  ): Promise<UserEntity> {
    const customerId = this.customerId(subscription.customer);
    const periodEnd = subscription.items.data[0]?.current_period_end;

    return this.usersService.updateBilling(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
      subscriptionCurrentPeriodEnd: periodEnd
        ? new Date(periodEnd * 1000)
        : null,
    });
  }

  private async getOrCreateCustomer(
    stripe: Stripe,
    user: UserEntity,
  ): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.username,
      metadata: { userId: user.id },
    });

    await this.usersService.updateBilling(user.id, {
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  private async resolveSubscription(
    stripe: Stripe,
    subscription: string | Stripe.Subscription | null,
  ): Promise<Stripe.Subscription | null> {
    if (!subscription) {
      return null;
    }

    if (typeof subscription !== 'string') {
      return subscription;
    }

    return stripe.subscriptions.retrieve(subscription);
  }

  private hasOpenSubscription(user: UserEntity): boolean {
    return (
      Boolean(user.stripeSubscriptionId) &&
      OPEN_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus)
    );
  }

  private customerId(customer: Stripe.Subscription['customer']): string | null {
    if (typeof customer === 'string') {
      return customer;
    }

    if ('deleted' in customer && customer.deleted) {
      return null;
    }

    return customer.id;
  }

  private frontendUrl(): string {
    return this.configService
      .get<string>(ENV_VARIABLES.FRONTEND_URL, 'http://localhost:3000')
      .replace(/\/$/, '');
  }

  private getStripe(): Stripe {
    const secretKey = this.configService.get<string>(
      ENV_VARIABLES.STRIPE_SECRET_KEY,
    );

    if (!secretKey) {
      throw new BadRequestException(ERROR_MESSAGES.BILLING_NOT_CONFIGURED);
    }

    if (!secretKey.startsWith(STRIPE_VALUES.TEST_SECRET_PREFIX)) {
      throw new BadRequestException(ERROR_MESSAGES.BILLING_TEST_MODE_ONLY);
    }

    return new Stripe(secretKey);
  }

  private async requireUser(userId: string): Promise<UserEntity> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return user;
  }
}
