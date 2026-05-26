import { PartialType } from '@nestjs/swagger';
import { CreateSettingRequest } from './create-setting.request';

// All fields optional — typically only `value` / `description` are changed.
export class UpdateSettingRequest extends PartialType(CreateSettingRequest) {}
