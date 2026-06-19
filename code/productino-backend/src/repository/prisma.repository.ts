import { PrismaService } from '../prisma.service';

export type EntityClass<T> = new (data: Partial<T>) => T;

/**
 * Generic repository over a Prisma model.
 *
 * Concrete repositories declare the model key and (optionally) an entity class.
 * When an entity class is supplied, every returned row is wrapped into an
 * active-record entity instance via `toEntity`.
 *
 *   @Injectable()
 *   export class ProjectRepository extends PrismaRepository<
 *     Project, Prisma.ProjectCreateInput, Prisma.ProjectUpdateInput
 *   > {
 *     protected readonly model = 'project' as const;
 *     constructor(prisma: PrismaService) { super(prisma, Project); }
 *   }
 */
export abstract class PrismaRepository<T, CreateInput, UpdateInput> {
  protected abstract readonly model: keyof PrismaService;
  private readonly entityClass?: EntityClass<T>;

  constructor(
    protected readonly prisma: PrismaService,
    entityClass?: EntityClass<T>,
  ) {
    this.entityClass = entityClass;
  }

  private get raw() {
    return this.prisma[this.model] as any;
  }

  // -- Entity mapping ----------------------------------------------

  private toEntity(data: any): T {
    if (!this.entityClass || data === null || data === undefined) return data;
    return new this.entityClass(data);
  }

  private toEntityList(data: any[]): T[] {
    if (!this.entityClass) return data;
    return data.map((item) => new this.entityClass!(item));
  }

  // -- Serialization -----------------------------------------------

  /**
   * Serialize data for Prisma. Values exposing a `toDBValue()` method are
   * converted via it (a hook for value objects); everything else passes through.
   */
  private serialize<D>(data: D): D {
    if (data === null || data === undefined || typeof data !== 'object') return data;
    const result: any = {};
    for (const [key, value] of Object.entries(data as any)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        'toDBValue' in value &&
        typeof (value as any).toDBValue === 'function'
      ) {
        result[key] = (value as any).toDBValue();
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // -- Read --------------------------------------------------------

  async findUnique(args: Record<string, any>): Promise<T | null> {
    return this.toEntity(await this.raw.findUnique(args));
  }

  async findUniqueOrThrow(args: Record<string, any>): Promise<T> {
    return this.toEntity(await this.raw.findUniqueOrThrow(args));
  }

  async findFirst(args?: Record<string, any>): Promise<T | null> {
    return this.toEntity(await this.raw.findFirst(args));
  }

  async findMany(args?: Record<string, any>): Promise<T[]> {
    return this.toEntityList(await this.raw.findMany(args));
  }

  async findById(id: number): Promise<T | null> {
    return this.findUnique({ where: { id } });
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    return this.findFirst({ where });
  }

  async findAll(): Promise<T[]> {
    return this.findMany();
  }

  async count(args?: Record<string, any>): Promise<number> {
    return this.raw.count(args);
  }

  async exists(where: Record<string, any>): Promise<boolean> {
    return (await this.raw.count({ where })) > 0;
  }

  async aggregate(args: Record<string, any>): Promise<any> {
    return this.raw.aggregate(args);
  }

  async groupBy(args: Record<string, any>): Promise<any[]> {
    return this.raw.groupBy(args);
  }

  // -- Write -------------------------------------------------------

  async create(data: CreateInput): Promise<T> {
    return this.toEntity(await this.raw.create({ data: this.serialize(data) }));
  }

  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    return this.raw.createMany({ data: data.map((d) => this.serialize(d)) });
  }

  async update(id: number, data: UpdateInput): Promise<T> {
    return this.toEntity(await this.raw.update({ where: { id }, data: this.serialize(data) }));
  }

  async updateWhere(where: Record<string, any>, data: UpdateInput): Promise<T> {
    return this.toEntity(await this.raw.update({ where, data: this.serialize(data) }));
  }

  async updateMany(where: Record<string, any>, data: UpdateInput): Promise<{ count: number }> {
    return this.raw.updateMany({ where, data: this.serialize(data) });
  }

  async upsert(where: Record<string, any>, create: CreateInput, update: UpdateInput): Promise<T> {
    return this.toEntity(
      await this.raw.upsert({
        where,
        create: this.serialize(create),
        update: this.serialize(update),
      }),
    );
  }

  async delete(id: number): Promise<T> {
    return this.toEntity(await this.raw.delete({ where: { id } }));
  }

  async deleteMany(where?: Record<string, any>): Promise<{ count: number }> {
    return this.raw.deleteMany({ where });
  }

  /**
   * Active-record persist: take an entity instance and write its current state
   * back to its row (id/createdAt/updatedAt are stripped before the update).
   */
  async save(entity: T & { id: number }): Promise<T> {
    const { id, createdAt, updatedAt, ...data } = this.serialize(entity as any);
    return this.toEntity(await this.raw.update({ where: { id: entity.id }, data }));
  }

  async saveMany(entities: Array<T & { id: number }>): Promise<T[]> {
    const operations = entities.map((entity) => {
      const { id, createdAt, updatedAt, ...data } = this.serialize(entity as any);
      return this.raw.update({ where: { id: entity.id }, data });
    });
    return this.toEntityList(await this.prisma.$transaction(operations));
  }
}
