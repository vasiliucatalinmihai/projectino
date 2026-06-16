import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Client } from '../../../entities';

export class ClientResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) accountId: number;
  @ApiProperty({ example: 'Acme Inc.' }) name: string;
  @ApiPropertyOptional({ example: 'ops@acme.example', nullable: true }) email: string | null;
  @ApiPropertyOptional({ example: '+40 700 000 001', nullable: true }) phone: string | null;
  @ApiPropertyOptional({ example: '1 Innovation Way, Cluj-Napoca', nullable: true })
  address: string | null;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiProperty({ example: 3, description: 'Number of projects for this client' })
  projectCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  constructor(partial: Partial<ClientResponse>) {
    Object.assign(this, partial);
  }

  static fromEntity(client: Client, projectCount = 0): ClientResponse {
    return new ClientResponse({
      id: client.id,
      accountId: client.accountId,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      notes: client.notes,
      projectCount,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    });
  }
}
