import { PartialType } from '@nestjs/swagger';
import { CreateAiModelRequest } from './create-ai-model.request';

export class UpdateAiModelRequest extends PartialType(CreateAiModelRequest) {}
