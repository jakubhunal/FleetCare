import { DemoRepository } from "../demo/repository";
import type { Repository } from "../data/contracts";
export const config = {
  adapter: "local",
  apiUrl: "",
  namespace: "fleetcare-demo-review-v1",
  label: "Ukázková data — prostředí pro schválení",
};
export function createRepository(): Repository {
  return new DemoRepository(config.namespace);
}
