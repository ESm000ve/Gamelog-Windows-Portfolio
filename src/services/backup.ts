import { BackupRepo } from "../db/repositories/BackupRepo";
export type { BackupData } from "./backupFormat";
export { parseBackup } from "./backupFormat";
export async function exportData(): Promise<void> {
  const json = await BackupRepo.exportBackup();
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "gamelog-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function importData(
  json: string,
  mode: "merge" | "replace",
  onProgress: (pct: number, message: string) => void
): Promise<string> {
  return BackupRepo.importBackup(json, mode, onProgress);
}
