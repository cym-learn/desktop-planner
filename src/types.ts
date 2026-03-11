export type Task = {
  id: string;
  content: string;
  ddl?: string;
  date: string | null; // 'YYYY-MM-DD' or null for unscheduled
  imageUrl?: string;
  isCompleted?: boolean;
  notified?: boolean;
  createdAt?: number;
};

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

