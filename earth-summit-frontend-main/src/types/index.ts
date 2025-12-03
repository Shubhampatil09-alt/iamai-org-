export type ViewState = "upload" | "confirm" | "results";

export interface Photo {
  id: string;
  url: string;
  capturedAt: string;
}
