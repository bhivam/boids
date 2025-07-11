export type Point = {
  leftOffset: number;
  topOffset: number;
};

export type BoundingBox = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

function boxBoxIntersection(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

function containsPoint(boundary: BoundingBox, item: Point): boolean {
  return (
    item.leftOffset >= boundary.left &&
    item.leftOffset < boundary.right &&
    item.topOffset >= boundary.top &&
    item.topOffset < boundary.bottom
  );
}

export class QuadTree<T extends Point> {
  boundary: BoundingBox;
  capacity: number;
  details:
    | {
        totalItems: number;
        items: T[];
        divided: false;
        northeast: null;
        northwest: null;
        southeast: null;
        southwest: null;
      }
    | {
        totalItems: number;
        items: null;
        divided: true;
        northeast: QuadTree<T>;
        northwest: QuadTree<T>;
        southeast: QuadTree<T>;
        southwest: QuadTree<T>;
      };

  constructor(boundary: BoundingBox, capacity: number) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.details = {
      totalItems: 0,
      items: [],
      divided: false,
      northeast: null,
      northwest: null,
      southeast: null,
      southwest: null,
    };
  }

  private contains(item: T): boolean {
    return containsPoint(this.boundary, item);
  }

  private boxIntersects(box: BoundingBox): boolean {
    return boxBoxIntersection(this.boundary, box);
  }

  insert(item: T): boolean {
    if (!this.contains(item)) return false;

    if (!this.details.divided && this.details.items.length >= this.capacity) {
      this.divide();
    }

    if (!this.details.divided) {
      this.details.totalItems += 1;
      this.details.items.push(item);
      return true;
    } else {
      if (this.details.northwest.insert(item)) {
        this.details.totalItems += 1;
        return true;
      }
      if (this.details.northeast.insert(item)) {
        this.details.totalItems += 1;
        return true;
      }
      if (this.details.southwest.insert(item)) {
        this.details.totalItems += 1;
        return true;
      }
      if (this.details.southeast.insert(item)) {
        this.details.totalItems += 1;
        return true;
      }

      throw new Error("Item does not fit in any child quadrant");
    }
  }

  divide(): void {
    if (this.details.divided) return;

    const { top, left, bottom, right } = this.boundary;
    const horizontalMid = (left + right) / 2;
    const verticalMid = (top + bottom) / 2;

    const itemsToDistribute = this.details.items;

    this.details = {
      totalItems: 0,
      northwest: new QuadTree(
        { top, left, bottom: verticalMid, right: horizontalMid },
        this.capacity,
      ),
      northeast: new QuadTree(
        { top, left: horizontalMid, bottom: verticalMid, right },
        this.capacity,
      ),
      southwest: new QuadTree(
        { top: verticalMid, left, bottom, right: horizontalMid },
        this.capacity,
      ),
      southeast: new QuadTree(
        { top: verticalMid, left: horizontalMid, bottom, right },
        this.capacity,
      ),
      divided: true,
      items: null,
    };

    for (const item of itemsToDistribute) {
      if (this.details.northwest.insert(item)) {
        this.details.totalItems += 1;
        continue;
      }
      if (this.details.northeast.insert(item)) {
        this.details.totalItems += 1;
        continue;
      }
      if (this.details.southwest.insert(item)) {
        this.details.totalItems += 1;
        continue;
      }
      if (this.details.southeast.insert(item)) {
        this.details.totalItems += 1;
        continue;
      }
      throw new Error("Item does not fit in any child quadrant");
    }
  }

  query(queryArea: BoundingBox): T[] {
    if (!this.boxIntersects(queryArea)) return [];

    if (this.details.divided) {
      return [
        ...this.details.northwest.query(queryArea),
        ...this.details.northeast.query(queryArea),
        ...this.details.southwest.query(queryArea),
        ...this.details.southeast.query(queryArea),
      ];
    }

    return this.details.items.filter((item) => containsPoint(queryArea, item));
  }
}
