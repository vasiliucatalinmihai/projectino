export abstract class BaseEntity {
  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
  }
}
