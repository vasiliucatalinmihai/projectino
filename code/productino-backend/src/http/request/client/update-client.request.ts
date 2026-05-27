import { PartialType } from '@nestjs/swagger';
import { CreateClientRequest } from './create-client.request';

export class UpdateClientRequest extends PartialType(CreateClientRequest) {}
