import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import type { AuthUser } from 'src/types/user.type';
import { BillingService } from './billing.service';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto';
import { SubscriptionStateDto } from './dto/subscription-state.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(AccessTokenGuard)
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser): Promise<CheckoutResponseDto> {
    return this.billingService.createCheckout(user.id);
  }

  @UseGuards(AccessTokenGuard)
  @Post('confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmCheckoutDto,
  ): Promise<SubscriptionStateDto> {
    return this.billingService.confirmCheckout(user.id, dto.sessionId);
  }

  @UseGuards(AccessTokenGuard)
  @Post('cancel')
  cancel(@CurrentUser() user: AuthUser): Promise<SubscriptionStateDto> {
    return this.billingService.cancelRenewal(user.id);
  }

  @UseGuards(AccessTokenGuard)
  @Post('resume')
  resume(@CurrentUser() user: AuthUser): Promise<SubscriptionStateDto> {
    return this.billingService.resumeRenewal(user.id);
  }

  @Post('webhook')
  webhook(
    @Req() request: Request,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.billingService.handleWebhook(request, signature);
  }
}
