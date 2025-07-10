import { match } from "ts-pattern";
import MaxHeap from "./heap";

enum FlockType {
  DISTANCE = "distance",
  SIZE = "size",
}

const NUM_BOIDS = 1000;
const MOVEMENT_SPEED = 1;
const LERP_CONST = 0.01;

const FLOCK_TYPE: FlockType = FlockType.DISTANCE;

const LOCAL_FLOCK_SIZE = 50;
const CLOSE_FLOCK_SIZE = 3;

const LOCAL_FLOCK_DISTANCE = 100;
const CLOSE_FLOCK_DISTANCE = 25;

type Boid = {
  topOffset: number;
  leftOffset: number;
  angle: number;
};

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

function drawBoid(ctx: CanvasRenderingContext2D, boid: Boid) {
  ctx.save();

  ctx.translate(boid.leftOffset, boid.topOffset);
  ctx.rotate(boid.angle);

  ctx.fillStyle = "blue";
  ctx.fillRect(-1, -5, 2, 10);

  ctx.restore();
}

function updateBoid(boid: Boid, _index: number, allBoids: Boid[]) {
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
      const getBoidsInRange = (range: number) =>
        allBoids.filter(
          (b) =>
            (b.leftOffset - boid.leftOffset) *
              (b.leftOffset - boid.leftOffset) +
              (b.topOffset - boid.topOffset) * (b.topOffset - boid.topOffset) <
            range * range,
        );
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

  boid.angle =
    boid.angle +
    (localAverageAngle - boid.angle) * LERP_CONST * (1 / 3) +
    (getAwayAngle - boid.angle) * LERP_CONST * (1 / 3) +
    (cohereAngle - boid.angle) * LERP_CONST * (1 / 3);

  boid.topOffset -= Math.cos(boid.angle) * MOVEMENT_SPEED;
  boid.leftOffset += Math.sin(boid.angle) * MOVEMENT_SPEED;
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
    boids.forEach(updateBoid);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boids.forEach((boid) => drawBoid(ctx, boid));

    animationId = requestAnimationFrame(() => animate(ctx));
  }

  window.addEventListener("beforeunload", () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });

  window.addEventListener("resize", () => {
    console.log(window.innerWidth, window.outerWidth);
  });

  animate(ctx);
}

main();
