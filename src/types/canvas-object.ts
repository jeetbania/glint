import type {
  CanvasObjectType,
  CanvasShapeVariant,
  CanvasFontFamily,
  CanvasTextAlign,
  CanvasConnectorType,
  CanvasConnectorDecoration,
  CanvasConnectorAnchor,
  CanvasConnectorBinding,
  CanvasConnectorStrokeStyle,
} from "@/db/schema";

export type ApiCanvasObject = {
  id: string;
  collectionId: string;
  type: CanvasObjectType;
  // sticky/text: note body. frame/connector: its label (see the
  // matching comment on the real canvasObjects.text column).
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
  // connector-only — see the schema comment on canvasObjects for why
  // x/y/w/h above are a derived cache rather than the source of truth
  // when type === "connector".
  points: { x: number; y: number }[] | null;
  connectorType: CanvasConnectorType | null;
  startDecoration: CanvasConnectorDecoration | null;
  endDecoration: CanvasConnectorDecoration | null;
  strokeStyle: CanvasConnectorStrokeStyle | null;
  startBinding: CanvasConnectorBinding | null;
  endBinding: CanvasConnectorBinding | null;
  // Any object type — see the schema comment.
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The four connector presets offered by the canvas toolbar — all four
 * create the exact same underlying `type: "connector"` object, just with
 * different connectorType/startDecoration/endDecoration (see
 * CONNECTOR_PRESETS in collection-canvas.tsx). Selecting one ARMS the
 * tool (crosshair cursor, drag-to-draw on the canvas) rather than
 * one-shot-placing something, unlike every other toolbar entry. */
export type ConnectorToolId = "line" | "arrow" | "two-way-arrow" | "elbow";

export type {
  CanvasObjectType,
  CanvasShapeVariant,
  CanvasFontFamily,
  CanvasTextAlign,
  CanvasConnectorType,
  CanvasConnectorDecoration,
  CanvasConnectorAnchor,
  CanvasConnectorBinding,
  CanvasConnectorStrokeStyle,
};
