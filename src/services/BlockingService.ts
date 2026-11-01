import { IBlockingService } from "../domain/services";
import { ChromeStorageRepository } from "../data/ChromeStorageRepository";
import { BlockReason, PolicyDecision } from "../domain/models";
import { evaluatePolicy } from "./policies";

export class BlockingService implements IBlockingService {
  constructor(private storageRepo: ChromeStorageRepository) {}
  async evaluate(url: string): Promise<PolicyDecision> {
    const [settings, data] = await Promise.all([
      this.storageRepo.getSettings(),
      this.storageRepo.getUsage(),
    ]);
    return evaluatePolicy(url, settings, data);
  }
  async getBlockReason(hostname: string, pathname = "/"): Promise<BlockReason> {
    return (await this.evaluate(`https://${hostname}${pathname}`)).reason;
  }
  async isBlocked(hostname: string, pathname?: string): Promise<boolean> {
    return (await this.getBlockReason(hostname, pathname)) !== "none";
  }
  async getRemainingTime(hostname: string): Promise<number> {
    return (await this.evaluate(`https://${hostname}/`)).remainingMs ?? -1;
  }
}
