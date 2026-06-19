import { ApiProperty } from '@nestjs/swagger';
import { DeliveryTree } from '../../../services/delivery.service';

/** Epic→Story→Task tree with rolled-up estimate ranges (days). */
export class DeliveryResponse {
  @ApiProperty({
    description: 'Nested epics → stories → tasks with per-node total estimate ranges',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  epics: any[];

  @ApiProperty({ example: 40, description: 'Project total — low end of the day estimate' })
  totalLow: number;

  @ApiProperty({ example: 65, description: 'Project total — high end of the day estimate' })
  totalHigh: number;

  constructor(tree: DeliveryTree) {
    this.epics = tree.epics;
    this.totalLow = tree.totalLow;
    this.totalHigh = tree.totalHigh;
  }
}

/** The delivery plan as a shareable markdown document. */
export class DeliveryDocResponse {
  @ApiProperty({ description: 'Delivery plan markdown (epics → stories → tasks with estimates)' })
  markdown: string;

  constructor(markdown: string) {
    this.markdown = markdown;
  }
}
