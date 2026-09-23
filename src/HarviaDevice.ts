import { HarviaAPI } from './api/HarviaAPI.js';
 
export interface DeviceStateSubscriber {
  onDeviceUpdate(device: HarviaDevice): void;
}
 
type OverridableField = 'active' | 'lightsOn' | 'fanOn' | 'steamOn' | 'targetTemp' | 'targetRh';
 
export class HarviaDevice {
  public active = false;
  public lightsOn = false;
  public fanOn = false;
  public steamOn = false;
  public targetTemp = 40;
  public targetRh = 0;
  public currentTemp = 0;
  public humidity = 0;
  public heatUpTime = 0;
  public remainingTime = 0;
  public statusCodes: string | number = '';
 
  public get isDoorOpen(): boolean {
    return String(this.statusCodes).length > 1
      && String(this.statusCodes)[1] === '9';
  }
 
  public lastUpdate: Date | null = null;
 
  private subscribers = new Set<DeviceStateSubscriber>();
 
  // Fields we've just told the cloud to change. AppSync's shadow doc fires
  // onStateUpdated the instant `desired` changes, with `reported` still at
  // the OLD value — that stale push is what makes HomeKit flip to the
  // opposite state for a moment before the real confirmation arrives.
  // While a field has a live entry here, any incoming value that
  // contradicts what we just asked for is treated as that stale echo
  // and dropped, instead of being written into local state.
  private optimisticOverrides = new Map<OverridableField, { value: boolean | number; expiresAt: number }>();
  private static readonly OPTIMISTIC_GRACE_MS = 8000;
 
  constructor(
    private readonly api: HarviaAPI,
    public readonly id: string,
    public readonly name: string
  ) {}
 
  public subscribe(subscriber: DeviceStateSubscriber): void {
    this.subscribers.add(subscriber);
    subscriber.onDeviceUpdate(this);
  }
 
  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber.onDeviceUpdate(this);
    }
  }
 
  private shouldAcceptIncoming(field: OverridableField, incoming: boolean | number): boolean {
    const override = this.optimisticOverrides.get(field);
    if (!override) return true;
 
    if (Date.now() > override.expiresAt) {
      // Cloud never confirmed within the grace window (command likely
      // failed silently, or is just slow) — stop trusting our own guess
      // and accept whatever the server reports now.
      this.optimisticOverrides.delete(field);
      return true;
    }
 
    if (incoming === override.value) {
      // Server has caught up with what we asked for — confirmed.
      this.optimisticOverrides.delete(field);
      return true;
    }
 
    // Still inside the grace window and this contradicts the value we
    // just requested — this is the stale echo. Drop it.
    return false;
  }
 
  public updateData(data: any): void {
    if (!data || typeof data !== 'object') return;
 
    if ('active' in data) {
      const value = Boolean(data.active);
      if (this.shouldAcceptIncoming('active', value)) this.active = value;
    }
    if ('heatOn' in data) {
      const value = Boolean(data.heatOn);
      if (this.shouldAcceptIncoming('active', value)) this.active = value;
    }
    if ('light' in data) {
      const value = Boolean(data.light);
      if (this.shouldAcceptIncoming('lightsOn', value)) this.lightsOn = value;
    }
    if ('fan' in data) {
      const value = Boolean(data.fan);
      if (this.shouldAcceptIncoming('fanOn', value)) this.fanOn = value;
    }
    if ('steamEn' in data) {
      const value = Boolean(data.steamEn);
      if (this.shouldAcceptIncoming('steamOn', value)) this.steamOn = value;
    }
    if ('steamOn' in data) {
      const value = Boolean(data.steamOn);
      if (this.shouldAcceptIncoming('steamOn', value)) this.steamOn = value;
    }
    if ('targetTemp' in data) {
      const value = Number(data.targetTemp);
      if (this.shouldAcceptIncoming('targetTemp', value)) this.targetTemp = value;
    }
    if ('targetRh' in data) {
      const value = Number(data.targetRh);
      if (this.shouldAcceptIncoming('targetRh', value)) this.targetRh = value;
    }
    if ('temperature' in data) this.currentTemp = Number(data.temperature);
    if ('humidity' in data) this.humidity = Number(data.humidity);
    if ('heatUpTime' in data) this.heatUpTime = Number(data.heatUpTime);
    if ('remainingTime' in data) this.remainingTime = Number(data.remainingTime);
    if ('statusCodes' in data) this.statusCodes = data.statusCodes;
    this.lastUpdate = new Date();
    this.notifySubscribers();
  }
 
  private getEndpoint(): string {
    return this.api.getEndpoint('device');
  }
 
  private async requestStateChange(payload: Record<string, unknown>): Promise<void> {
    const body = {
      operationName: 'Mutation',
      variables: {
        deviceId: this.id,
        state: JSON.stringify(payload),
        getFullState: false,
      },
      query: `mutation Mutation($deviceId: ID!, $state: AWSJSON!, $getFullState: Boolean) {\n  requestStateChange(deviceId: $deviceId, state: $state, getFullState: $getFullState)\n}\n`,
    };
    await this.api.appsyncRequest(this.getEndpoint(), body);
  }
 
  // Writes `value` locally straight away (so HomeKit reflects the tap
  // with zero lag), records it as the expected value for the grace
  // window, then sends the mutation. If the mutation itself throws, the
  // optimistic value is rolled back so the accessory snaps to its real
  // last-known state instead of silently lying to the user.
  private async applyOptimistic<T extends boolean | number>(
    field: OverridableField,
    value: T,
    payload: Record<string, unknown>
  ): Promise<void> {
    const previous = (this as any)[field];
    (this as any)[field] = value;
    this.optimisticOverrides.set(field, { value, expiresAt: Date.now() + HarviaDevice.OPTIMISTIC_GRACE_MS });
    this.notifySubscribers();
 
    try {
      await this.requestStateChange(payload);
    } catch (error) {
      this.optimisticOverrides.delete(field);
      (this as any)[field] = previous;
      this.notifySubscribers();
      throw error;
    }
  }
 
  public async setActive(value: boolean): Promise<void> {
    await this.applyOptimistic('active', value, { active: value ? 1 : 0 });
  }
 
  public async setLight(value: boolean): Promise<void> {
    await this.applyOptimistic('lightsOn', value, { light: value ? 1 : 0 });
  }
 
  public async setFan(value: boolean): Promise<void> {
    await this.applyOptimistic('fanOn', value, { fan: value ? 1 : 0 });
  }
 
  public async setSteamer(value: boolean): Promise<void> {
    await this.applyOptimistic('steamOn', value, { steamEn: value ? 1 : 0 });
  }
 
  public async setTargetTemperature(value: number): Promise<void> {
    await this.applyOptimistic('targetTemp', value, { targetTemp: value });
  }
 
  public async setTargetHumidity(value: number): Promise<void> {
    await this.applyOptimistic('targetRh', value, { targetRh: value });
  }
}
 
