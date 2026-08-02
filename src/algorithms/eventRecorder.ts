import { EVENT_TYPE } from '../types/graph';

export class EventRecorder {
  private buffer: Uint32Array;
  private count: number = 0;
  private capacity: number;

  constructor(initialCapacity: number = 100000) {
    this.capacity = initialCapacity;
    this.buffer = new Uint32Array(initialCapacity * 2);
  }

  private ensureCapacity(neededPairs: number) {
    if (this.count + neededPairs > this.capacity) {
      this.capacity = Math.max(this.capacity * 2, this.count + neededPairs + 50000);
      const newBuffer = new Uint32Array(this.capacity * 2);
      newBuffer.set(this.buffer.subarray(0, this.count * 2));
      this.buffer = newBuffer;
    }
  }

  public add(eventType: number, entityId: number) {
    this.ensureCapacity(1);
    const idx = this.count * 2;
    this.buffer[idx] = eventType;
    this.buffer[idx + 1] = entityId;
    this.count++;
  }

  public getTypedArray(): Uint32Array {
    return this.buffer.subarray(0, this.count * 2);
  }

  public getCount(): number {
    return this.count;
  }
}
