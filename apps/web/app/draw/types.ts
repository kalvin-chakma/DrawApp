export type StrokeType = "pencil" | "rect" | "circle" | "line";

export type LineVariant = "solid" | "dashed" | "arrow" | "dashed-arrow";

export interface DrawEvent {
  type: "draw_start" | "draw_move" | "draw_end" | "erase_partial";
  roomId: string;
  x: number;
  y: number;
  color?: string;
  lineWidth?: number;
  strokeId?: number;
  strokeType?: StrokeType;
  lineVariant?: LineVariant;
  // Partial-erase fields
  erasedId?: number;
  replacements?: Array<{
    id: number;
    type: StrokeType;
    points: Point[];
    color: string;
    lineWidth: number;
  }>;
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: number;
  type: StrokeType;
  points: Point[];
  color: string;
  lineWidth: number;
  lineVariant?: LineVariant;
}

export interface ViewTransform {
  tx: number;
  ty: number;
  scale: number;
}

export interface Ref<T> {
  current: T;
}
