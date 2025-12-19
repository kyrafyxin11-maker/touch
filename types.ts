export interface TelemetryData {
  rotationSpeed: string;
  zoomLevel: string;
  mode: string;
  handDetected: boolean;
  fps?: number;
}

export enum InteractionMode {
  IDLE = "AUTO PILOT",
  ROTATING = "ROTATION ACTIVE",
  ZOOM_IN = "ZOOM IN",
  ZOOM_OUT = "ZOOM OUT",
  MOUSE = "MOUSE ACTIVE"
}

export interface HologramConfig {
  bgColor: string;
}
