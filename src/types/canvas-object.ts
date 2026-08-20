import type {
  CanvasObjectType,
  CanvasShapeVariant,
  CanvasFontFamily,
  CanvasTextAlign,
} from "@/db/schema";

export type ApiCanvasObject = {
  id: string;
  collectionId: string;
  type: CanvasObjectType;
  text: string | null;
  shapeVariant: CanvasShapeVariant | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  zIndex: number;
  fill: string | null;
  textColor: string | null;
  fontFamily: CanvasFontFamily;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: CanvasTextAlign;
  createdAt: string;
  updatedAt: string;
};

export type {
  CanvasObjectType,
  CanvasShapeVariant,
  CanvasFontFamily,
  CanvasTextAlign,
};
