import { ApiProperty } from '@nestjs/swagger';

/** The client-facing questions document (markdown). Internal scoring is excluded. */
export class QuestionsDocResponse {
  @ApiProperty({ description: 'Client-facing questions as markdown' })
  markdown: string;

  constructor(markdown: string) {
    this.markdown = markdown;
  }
}
