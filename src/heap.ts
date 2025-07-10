export default class MaxHeap<T> {
  private entries: { val: number; data: T }[] = [];

  private swap(i: number, j: number) {
    const x = this.entries[i];
    this.entries[i] = this.entries[j];
    this.entries[j] = x;
  }

  public push(val: number, data: T) {
    this.entries.push({ val, data });
    let i = this.entries.length - 1;

    while (i > 0) {
      const j = Math.floor((i - 1) / 2);
      if (this.entries[j].val >= val) break;
      this.swap(i, j);
      i = j;
    }
  }

  public pop() {
    if (this.entries.length === 0) return undefined;
    this.swap(0, this.entries.length - 1);
    const top = this.entries.pop();

    let i = 0;
    while (true) {
      let largest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;

      if (
        l < this.entries.length &&
        this.entries[l].val > this.entries[largest].val
      )
        largest = l;

      if (
        r < this.entries.length &&
        this.entries[r].val > this.entries[largest].val
      )
        largest = r;

      if (largest === i) break;
      this.swap(largest, i);
      i = largest;
    }

    return top;
  }

  public peekMaxVal() {
    if (this.entries.length === 0) return undefined;
    return this.entries[0].val;
  }

  public size() {
    return this.entries.length;
  }

  public getData() {
    return this.entries.map((entry) => entry.data);
  }
}
