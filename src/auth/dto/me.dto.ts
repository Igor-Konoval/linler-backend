import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({
    example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614',
  })
  id!: string;

  @ApiProperty({
    example: 'test@gmail.com',
  })
  email!: string;

  @ApiProperty({
    example: 'Admin',
  })
  username!: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
  })
  avatarUrl!: string | null;

  @ApiProperty({ example: false })
  subscriptionActive!: boolean;

  @ApiProperty({ example: false })
  subscriptionCancelAtPeriodEnd!: boolean;

  @ApiProperty({ example: null, nullable: true })
  subscriptionCurrentPeriodEnd!: string | null;
}
