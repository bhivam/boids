import { match } from "ts-pattern";
import MaxHeap from "./heap";
import { QuadTree } from "./quad_tree";

enum FlockType {
  DISTANCE = "distance",
  SIZE = "size",
}

enum BoidStyle {
  RECTANGLE = "rectangle",
  TRIANGLE = "triangle",
}

const NUM_BOIDS = 2000;
const MOVEMENT_SPEED = 2;
const LERP_CONST = 0.1;

const FLOCK_TYPE: FlockType = FlockType.DISTANCE;

const LOCAL_FLOCK_SIZE = 50;
const CLOSE_FLOCK_SIZE = 3;

const LOCAL_FLOCK_DISTANCE = 200;
const CLOSE_FLOCK_DISTANCE = 50;

const QUAD_TREE_CAPACITY = 64;
const QUAD_TREE_DEBUG = false;

const BOID_SIZE = 2;
const BOID_LW_RATIO = 10;
const BOID_STYLE: BoidStyle = BoidStyle.TRIANGLE;
const BOID_COLOR = "blue";

const SHOW_STATS = true;
const STATS_FONT_SIZE = 40;

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

function drawStats(
  ctx: CanvasRenderingContext2D,
  quadTree: QuadTree<Point>,
  fps: number,
) {
  ctx.save();

  ctx.fillStyle = "black";
  ctx.font = `${STATS_FONT_SIZE}px arial`;
  ctx.fillText(
    `Boids In Canvas: ${quadTree.details.totalItems.toString()} FPS: ${fps.toPrecision(2)}`,
    10,
    STATS_FONT_SIZE + 10,
  );

  ctx.restore();
}

function drawDebugQuadTree(
  ctx: CanvasRenderingContext2D,
  quadTree: QuadTree<Point>,
  depth = 0,
) {
  const box = quadTree.boundary;
  ctx.save();

  const colors = [
    "#00bfff", // light blue
    "#00ff99", // green
    "#ffcc00", // yellow
    "#ff6699", // pink
    "#ff3300", // red
    "#9933ff", // purple
  ];
  const color = colors[depth % colors.length];

  ctx.lineWidth = Math.max(1, 4 - depth * 0.5);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;

  ctx.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);

  ctx.fillStyle = color;

  if (!quadTree.details.divided) {
    quadTree.details.items.forEach((pt: Point) => {
      ctx.beginPath();
      ctx.arc(pt.leftOffset, pt.topOffset, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  ctx.restore();

  // Recursively draw children
  if (quadTree.details.divided) {
    drawDebugQuadTree(ctx, quadTree.details.northwest, depth + 1);
    drawDebugQuadTree(ctx, quadTree.details.northeast, depth + 1);
    drawDebugQuadTree(ctx, quadTree.details.southwest, depth + 1);
    drawDebugQuadTree(ctx, quadTree.details.southeast, depth + 1);
  }
}

function drawBoid(ctx: CanvasRenderingContext2D, boid: Boid) {
  ctx.save();
  ctx.translate(boid.leftOffset, boid.topOffset);
  ctx.rotate(boid.angle);

  ctx.fillStyle = BOID_COLOR;

  match(BOID_STYLE)
    .with(BoidStyle.TRIANGLE, () => {
      ctx.beginPath();
      ctx.moveTo(0, -BOID_SIZE * 2);
      ctx.lineTo(-BOID_SIZE, BOID_SIZE * 2);
      ctx.lineTo(BOID_SIZE, BOID_SIZE * 2);
      ctx.closePath();
      ctx.fill();
    })
    .with(BoidStyle.RECTANGLE, () => {
      ctx.fillRect(
        -BOID_SIZE / 2,
        (BOID_LW_RATIO * -BOID_SIZE) / 2,
        BOID_SIZE,
        BOID_SIZE * BOID_LW_RATIO,
      );
    })
    .exhaustive();

  ctx.restore();
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
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
    localFlock.length > 0
      ? localFlock.reduce((sum, curr) => sum + curr.angle, 0) /
        localFlock.length
      : boid.angle;

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

  boid.topOffset = mod(boid.topOffset, canvas.height);
  boid.leftOffset = mod(boid.leftOffset, canvas.width);
}

function main() {
  const canvas = document.getElementById("canvasElement") as HTMLCanvasElement;

  if (!canvas) {
    throw new Error("Could not find canvas element");
  }

  function setCanvasResolution() {
    canvas.width = window.innerWidth * 2;
    canvas.height = window.innerHeight * 2;

    canvas.style.width = `100%`;
    canvas.style.height = `100%`;
  }

  setCanvasResolution();

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get 2D rendering context");
  }

  let animationId: number;
  let prevCall: DOMHighResTimeStamp | undefined = undefined;

  const boids = initBoids(NUM_BOIDS, 0, 0, canvas.width, canvas.height);

  function animate(ctx: CanvasRenderingContext2D) {
    let fps: number | undefined = undefined;
    const currCall = performance.now();
    if (prevCall) {
      fps = 1000 / (currCall - prevCall);
    }
    prevCall = currCall;

    const quadTree = new QuadTree<Boid>(
      { left: 0, top: 0, right: canvas.width, bottom: canvas.height },
      QUAD_TREE_CAPACITY,
    );

    boids.forEach((boid) => quadTree.insert(boid));

    boids.forEach((boid, idx, allBoids) =>
      updateBoid(boid, idx, allBoids, quadTree, canvas),
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boids.forEach((boid) => drawBoid(ctx, boid));

    if (QUAD_TREE_DEBUG) drawDebugQuadTree(ctx, quadTree);

    if (SHOW_STATS) drawStats(ctx, quadTree, fps ?? 0);

    animationId = requestAnimationFrame(() => animate(ctx));
  }

  window.addEventListener("beforeunload", () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });

  window.addEventListener("resize", setCanvasResolution);

  animate(ctx);
}

main();
