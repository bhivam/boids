import { match } from "ts-pattern";
import MaxHeap from "./heap";
import { QuadTree } from "./quad_tree";

enum FlockType {
  DISTANCE = "distance",
  SIZE = "size",
}

const NUM_BOIDS = 5000;
const MOVEMENT_SPEED = 5;
const LERP_CONST = 0.01;

const FLOCK_TYPE: FlockType = FlockType.DISTANCE;

const LOCAL_FLOCK_SIZE = 50;
const CLOSE_FLOCK_SIZE = 3;

const LOCAL_FLOCK_DISTANCE = 200;
const CLOSE_FLOCK_DISTANCE = 100;

const QUAD_TREE_DEBUG = true;

const BOID_SIZE = 2;
const BOID_LW_RATIO = 5;
const BOID_COLOR = "blue";

export type Point = {
  topOffset: number;
  leftOffset: number;
};

type Boid = {
  angle: number;
} & Point;

function initBoids(
  numBoids: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): Boid[] {
  return Array.from({ length: numBoids }).map(() => ({
    leftOffset: Math.random() * (right - left),
    topOffset: Math.random() * (bottom - top),
    angle: Math.random() * 2 * Math.PI,
  }));
}

function drawDebugQuadTree(
  ctx: CanvasRenderingContext2D,
  quadTree: QuadTree<Point>,
) {
  const box = quadTree.boundary;
  ctx.save();

  ctx.lineWidth = 1;

  ctx.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);

  ctx.restore();

  if (quadTree.details.divided) {
    drawDebugQuadTree(ctx, quadTree.details.northwest);
    drawDebugQuadTree(ctx, quadTree.details.northeast);
    drawDebugQuadTree(ctx, quadTree.details.southwest);
    drawDebugQuadTree(ctx, quadTree.details.southeast);
  }
}

function drawBoid(ctx: CanvasRenderingContext2D, boid: Boid) {
  ctx.save();

  ctx.translate(boid.leftOffset, boid.topOffset);
  ctx.rotate(boid.angle);

  ctx.fillStyle = BOID_COLOR;
  ctx.fillRect(
    -BOID_SIZE / 2,
    (BOID_LW_RATIO * -BOID_SIZE) / 2,
    BOID_SIZE,
    BOID_SIZE * BOID_LW_RATIO,
  );

  ctx.restore();
}

function updateBoid(
  boid: Boid,
  _index: number,
  allBoids: Boid[],
  quadTree: QuadTree<Boid>,
  canvas: HTMLCanvasElement,
) {
  const flocks = match(FLOCK_TYPE)
    .with(FlockType.SIZE, () => {
      const heap = new MaxHeap<Boid>();

      allBoids.forEach((other) => {
        if (other === boid) return;

        const squaredDistance =
          (other.topOffset - boid.topOffset) *
            (other.topOffset - boid.topOffset) +
          (other.leftOffset - boid.leftOffset) *
            (other.leftOffset - boid.leftOffset);

        if (heap.size() < LOCAL_FLOCK_SIZE) {
          heap.push(squaredDistance, other);
        } else if (squaredDistance < (heap.peekMaxVal() ?? Infinity)) {
          (heap.pop(), heap.push(squaredDistance, other));
        }
      });

      const local = heap.getData();
      const close = local.slice(0, CLOSE_FLOCK_SIZE);

      return { local, close };
    })
    .with(FlockType.DISTANCE, () => {
      const getBoidsInRange = (r: number) =>
        quadTree.query({
          top: boid.topOffset - r,
          bottom: boid.topOffset + r,
          left: boid.leftOffset - r,
          right: boid.leftOffset + r,
        });
      return {
        local: getBoidsInRange(LOCAL_FLOCK_DISTANCE),
        close: getBoidsInRange(CLOSE_FLOCK_DISTANCE),
      };
    })
    .exhaustive();

  const localFlock = flocks.local;
  const closeFlock = flocks.close;

  const localAverageAngle =
    localFlock.reduce((sum, curr) => sum + curr.angle, 0) / localFlock.length;

  const closeFlockSummedDifference = closeFlock.reduce(
    (location, curr) => ({
      topOffset: location.topOffset + (curr.topOffset - boid.topOffset),
      leftOffset: location.leftOffset + (curr.leftOffset - boid.leftOffset),
    }),
    {
      topOffset: 0,
      leftOffset: 0,
    },
  );

  const getAwayAngle = Math.atan2(
    closeFlockSummedDifference.topOffset,
    -closeFlockSummedDifference.leftOffset,
  );

  const localFlockSummedDifference = localFlock.reduce(
    (location, curr) => ({
      topOffset: location.topOffset + (curr.topOffset - boid.topOffset),
      leftOffset: location.leftOffset + (curr.leftOffset - boid.leftOffset),
    }),
    {
      topOffset: 0,
      leftOffset: 0,
    },
  );

  const cohereAngle = Math.atan2(
    -localFlockSummedDifference.topOffset,
    localFlockSummedDifference.leftOffset,
  );

  const lerpAngleDiff = (to: number, from: number) =>
    ((to - from + Math.PI) % (2 * Math.PI)) - Math.PI;

  boid.angle =
    boid.angle +
    lerpAngleDiff(localAverageAngle, boid.angle) * LERP_CONST * (1 / 3) +
    lerpAngleDiff(getAwayAngle, boid.angle) * LERP_CONST * (1 / 3) +
    lerpAngleDiff(cohereAngle, boid.angle) * LERP_CONST * (1 / 3);

  boid.topOffset -= Math.cos(boid.angle) * MOVEMENT_SPEED;
  boid.leftOffset += Math.sin(boid.angle) * MOVEMENT_SPEED;

  if (boid.topOffset < 0) boid.topOffset = canvas.height;
  if (boid.topOffset > canvas.height) boid.topOffset = 0;
  if (boid.leftOffset < 0) boid.leftOffset = canvas.width;
  if (boid.leftOffset > canvas.width) boid.leftOffset = 0;
}

function main() {
  const canvas = document.getElementById("canvasElement") as HTMLCanvasElement;

  if (!canvas) {
    throw new Error("Could not find canvas element");
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get 2D rendering context");
  }

  let animationId: number;

  const boids = initBoids(NUM_BOIDS, 0, 0, canvas.width, canvas.height);

  function animate(ctx: CanvasRenderingContext2D) {
    const quadTree = new QuadTree<Boid>(
      { left: 0, top: 0, right: canvas.width, bottom: canvas.height },
      50,
    );

    boids.forEach((boid, idx) => quadTree.insert(boid));

    boids.forEach((boid, idx, allBoids) =>
      updateBoid(boid, idx, allBoids, quadTree, canvas),
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boids.forEach((boid) => drawBoid(ctx, boid));

    if (QUAD_TREE_DEBUG) drawDebugQuadTree(ctx, quadTree);

    animationId = requestAnimationFrame(() => animate(ctx));
  }

  window.addEventListener("beforeunload", () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  animate(ctx);
}

main();
