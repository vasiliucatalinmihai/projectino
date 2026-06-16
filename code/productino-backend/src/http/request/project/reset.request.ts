import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const RESET_FROM = ['graph', 'definition', 'delivery', 'proposal'] as const;

export class ResetRequest {
  @ApiProperty({
    enum: RESET_FROM,
    description:
      "Which step to reset from; everything downstream is cleared too. 'graph' wipes the " +
      'whole Belief Graph (keeps sources) and resets the stage to BRIEFING.',
  })
  @IsIn(RESET_FROM as unknown as string[])
  from: (typeof RESET_FROM)[number];
}
