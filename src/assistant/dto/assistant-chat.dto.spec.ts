import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ASSISTANT_ROLE } from 'src/constants/assistant.constants';
import { AssistantChatDto } from './assistant-chat.dto';

describe('AssistantChatDto', () => {
  it('accepts long assistant replies in history while limiting new messages', async () => {
    const dto = plainToInstance(AssistantChatDto, {
      message: 'Continue.',
      history: [
        {
          role: ASSISTANT_ROLE.ASSISTANT,
          content: 'a'.repeat(2_001),
        },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);

    const oversizedMessage = plainToInstance(AssistantChatDto, {
      message: 'a'.repeat(2_001),
    });

    await expect(validate(oversizedMessage)).resolves.not.toHaveLength(0);
  });
});
