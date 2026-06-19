import { Injectable } from '@nestjs/common';
import { PerKeyLock } from '../common/concurrency';

@Injectable()
export class PipelineLockService {
  private readonly lock = new PerKeyLock();

  run<T>(projectId: number, fn: () => Promise<T>): Promise<T> {
    return this.lock.run(`project:${projectId}`, fn);
  }
}
