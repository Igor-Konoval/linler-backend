import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class MarkInvitationsReadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  invitationIds!: string[];
}
