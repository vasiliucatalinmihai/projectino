/**
 * Active-record style base entity.
 *
 * Every entity is constructed from a plain object (typically a Prisma row) and
 * copies those fields onto itself, so an entity instance *is* the record. The
 * matching repository's `save(entity)` persists the instance back to the DB.
 *
 * Subclasses override the constructor only to narrow the `partial` type:
 *
 *   export class Project extends BaseEntity {
 *     id: number;
 *     name: string;
 *     constructor(partial: Partial<Project>) { super(partial); }
 *   }
 */
export abstract class BaseEntity {
  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
  }
}
