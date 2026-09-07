export interface ResourceProcess {
  pid: number;
  createdAt: number;
  name: string;
  group: "Backend" | "Desktop" | "Helpers";
  cpu: number | null;
  memory: number;
}

export interface ResourceSnapshot {
  sampledAt: number;
  processes: ResourceProcess[];
  cpu: number | null;
  memory: number;
  collectionMs: number;
  host: {
    platform: string;
    arch: string;
    cores: number;
    totalMemory: number;
    freeMemory: number;
    uptime: number;
    onBattery: boolean;
    thermal: string;
    idle: string;
    idleSeconds: number;
  };
}
