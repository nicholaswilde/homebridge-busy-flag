import { StatusColors } from ".";

export interface PresenceConfig {
  name: string;
  accessory: string;
  appId: string;
  hostname: string;
  port: number;
  upApi: string;
  downApi: string;
  interval: number;
  setColorApi: string;
  offApi: string;
  onApi: string;
  startTime: string;
  endTime: string;
  lightType: string;
  statusColors: StatusColors;
  weekend: boolean;
  debug: boolean;
}