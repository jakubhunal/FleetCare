import { FleetDatabase, LocalRepository } from "../data/local";
import type { Actor } from "../domain/models";
import { ensureDemoSeed } from "./seed";
export class DemoRepository extends LocalRepository {
  private initialized: Promise<void> | null = null;
  constructor(namespace: string) {
    super(new FleetDatabase(namespace));
  }
  private initialize() {
    return (this.initialized ??= ensureDemoSeed(this.db));
  }
  override async read(actor: Actor) {
    await this.initialize();
    return super.read(actor);
  }
  override async identities() {
    await this.initialize();
    return super.identities();
  }
}
