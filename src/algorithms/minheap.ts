export class MinHeap<T> {
  private heap: { priority: number; item: T }[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(priority: number, item: T): void {
    this.heap.push({ priority, item });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.isEmpty()) return undefined;
    const top = this.heap[0].item;
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      if (this.heap[index].priority < this.heap[parentIndex].priority) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[parentIndex];
        this.heap[parentIndex] = temp;
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const leftChild = (index << 1) + 1;
      const rightChild = (index << 1) + 2;

      if (leftChild < length && this.heap[leftChild].priority < this.heap[smallest].priority) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].priority < this.heap[smallest].priority) {
        smallest = rightChild;
      }

      if (smallest !== index) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[smallest];
        this.heap[smallest] = temp;
        index = smallest;
      } else {
        break;
      }
    }
  }
}
