export interface RecapSource {
  id: number;
  text: string;
}
export interface RecapBullet {
  text: string;
  sourceIds: number[];
}
export interface ResumeRecap {
  bullets: RecapBullet[];
  sources: RecapSource[];
  savedAt: number;
  sourceLogUpdatedAt: number;
}
