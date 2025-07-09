const NUM_BOIDS = 100;
const MOVEMENT_SPEED = 1;

type Boid = {
  topOffset: number;
  leftOffset: number;
  angle: number;
};

function initBoids(
  numBoids: number,
  top: number,
  left: number,
  bottom: number,
  right: number,
): Boid[] {
  return Array.from({ length: numBoids }).map(() => ({
    leftOffset: Math.random() * (right - left),
    topOffset: Math.random() * (bottom - top),
    angle: Math.random() * 2 * Math.PI,
  }));
}

function drawBoid(ctx: CanvasRenderingContext2D, boid: Boid) {
  ctx.save();

  ctx.rotate(boid.angle);

  ctx.fillStyle = "blue";
  ctx.fillRect(boid.leftOffset - 5, boid.topOffset - 25, 10, 50);

  ctx.restore();
}

function updateBoid(boid: Boid, index: number, allBoids: Boid[]) {
  boid.topOffset -= MOVEMENT_SPEED;
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

  animate(ctx);
}

main();
