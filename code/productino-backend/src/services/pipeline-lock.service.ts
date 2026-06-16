import { Injectable } from '@nestjs/common';
import { KeyedMutex } from '../common/concurrency';

/**
 * Serializes pipeline mutations per project, so two concurrent requests for the
 * same project (e.g. a double-clicked "Score") can't race — duplicate
 * ProjectRound indexes, half-applied cascades, etc. Different projects still run
 * in parallel. Single-instance; the multi-instance equivalent is a Postgres
 * advisory lock.
 */
@Injectable()
export class PipelineLockService {
  private readonly mutex = new KeyedMutex();

  run<T>(projectId: number, fn: () => Promise<T>): Promise<T> {
    return this.mutex.run(`project:${projectId}`, fn);
  }
}
