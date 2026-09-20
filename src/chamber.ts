import { sound } from './audio';

export type BallType = 'standard' | 'lightning' | 'fire' | 'heavy';

export interface FlowerBumper {
  id: number;
  relX: number; // 0..1 ratio of chamber width
  relY: number; // 0..1 ratio of chamber height
  baseRadius: number;
  scale: number;
  squashVel: number;
  type: 'nova' | 'slash' | 'multistrike';
}

export interface CloudPuff {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface BallParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Ball {
  id: number;
  type: BallType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  squashX: number;
  squashY: number;
  baseSpeed: number;
}

export class BounceChamber {
  public x: number = 0;
  public y: number = 0;
  public width: number = 0;
  public height: number = 0;

  public balls: Ball[] = [];
  public bumpers: FlowerBumper[] = [];
  public puffs: CloudPuff[] = [];
  public particles: BallParticle[] = [];

  public bumperRadiusMultiplier: number = 1.0;
  public ballSpeedMultiplier: number = 1.0;
  private nextBallId: number = 1;

  private onHitCallback: (
    bumperType: 'nova' | 'slash' | 'multistrike',
    bumperId: number,
    ballType: BallType
  ) => void;

  constructor(
    onHit: (
      bumperType: 'nova' | 'slash' | 'multistrike',
      bumperId: number,
      ballType: BallType
    ) => void
  ) {
    this.onHitCallback = onHit;
    this.initBumpers();
    this.initBall();
  }

  public initBumpers() {
    // 5 Flower Bumpers matching the exact video layout:
    // 0: Top-Left (Slash)
    // 1: Top-Right (Slash)
    // 2: Center (Nova AOE)
    // 3: Bottom-Left (Multi-Strike)
    // 4: Bottom-Right (Multi-Strike)
    this.bumpers = [
      { id: 0, relX: 0.20, relY: 0.135, baseRadius: 36, scale: 1.0, squashVel: 0, type: 'slash' },
      { id: 1, relX: 0.81, relY: 0.130, baseRadius: 36, scale: 1.0, squashVel: 0, type: 'slash' },
      { id: 2, relX: 0.50, relY: 0.503, baseRadius: 38, scale: 1.0, squashVel: 0, type: 'nova' },
      { id: 3, relX: 0.18, relY: 0.868, baseRadius: 36, scale: 1.0, squashVel: 0, type: 'multistrike' },
      { id: 4, relX: 0.80, relY: 0.874, baseRadius: 36, scale: 1.0, squashVel: 0, type: 'multistrike' }
    ];
  }

  public initBall() {
    this.balls = [];
    this.addBall('standard');
  }

  public addBall(type: BallType = 'standard') {
    let speed = 480;
    let radius = 12;

    if (type === 'lightning') {
      speed = 660; // Very fast
      radius = 11;
    } else if (type === 'fire') {
      speed = 520;
      radius = 13;
    } else if (type === 'heavy') {
      speed = 400; // Slow & heavy
      radius = 17;
    }

    const baseSpeed = speed * this.ballSpeedMultiplier;
    // Launch at dynamic angle
    const angle = (Math.PI / 4) + (Math.random() * 0.4 - 0.2);
    const signX = Math.random() > 0.5 ? 1 : -1;
    const signY = Math.random() > 0.5 ? 1 : -1;

    this.balls.push({
      id: this.nextBallId++,
      type,
      x: this.width > 0 ? this.width * (0.3 + Math.random() * 0.4) : 200,
      y: this.height > 0 ? this.height * (0.2 + Math.random() * 0.4) : 300,
      vx: Math.cos(angle) * baseSpeed * signX,
      vy: Math.sin(angle) * baseSpeed * signY,
      radius,
      squashX: 1,
      squashY: 1,
      baseSpeed: speed
    });
  }

  public resize(x: number, y: number, width: number, height: number) {
    const oldW = this.width;
    const oldH = this.height;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    if (oldW > 0 && oldH > 0) {
      for (const b of this.balls) {
        b.x = (b.x / oldW) * width;
        b.y = (b.y / oldH) * height;
      }
    } else {
      for (const b of this.balls) {
        b.x = width * 0.5;
        b.y = height * 0.3;
      }
    }
  }

  public update(dt: number) {
    // Update bumpers animation (spring damping)
    for (const bumper of this.bumpers) {
      const force = (1.0 - bumper.scale) * 35;
      bumper.squashVel += force * dt;
      bumper.squashVel *= Math.pow(0.85, dt * 60);
      bumper.scale += bumper.squashVel * dt;
    }

    // Update cloud puffs
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life += dt;
      const progress = p.life / p.maxLife;
      p.radius = p.maxRadius * (0.4 + 0.6 * Math.sin(progress * Math.PI * 0.5));
      p.alpha = Math.max(0, 1 - progress);
      if (p.life >= p.maxLife) {
        this.puffs.splice(i, 1);
      }
    }

    // Update particles (fire embers & lightning sparks)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Update balls
    for (const ball of this.balls) {
      // Ease ball squash back to 1
      ball.squashX += (1 - ball.squashX) * Math.min(1, dt * 15);
      ball.squashY += (1 - ball.squashY) * Math.min(1, dt * 15);

      // Ball trails & emission
      if (ball.type === 'fire') {
        // Flame particles
        if (Math.random() < 0.75) {
          this.particles.push({
            x: ball.x + (Math.random() * 8 - 4),
            y: ball.y + (Math.random() * 8 - 4),
            vx: -ball.vx * 0.1 + (Math.random() * 20 - 10),
            vy: -ball.vy * 0.1 - (Math.random() * 25),
            size: 4 + Math.random() * 5,
            color: Math.random() > 0.4 ? '#f97316' : '#fbbf24',
            alpha: 0.9,
            life: 0,
            maxLife: 0.3
          });
        }
      } else if (ball.type === 'lightning') {
        // Electric sparks
        if (Math.random() < 0.6) {
          this.particles.push({
            x: ball.x + (Math.random() * 10 - 5),
            y: ball.y + (Math.random() * 10 - 5),
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            size: 2.5 + Math.random() * 3,
            color: Math.random() > 0.3 ? '#38bdf8' : '#e0f2fe',
            alpha: 1.0,
            life: 0,
            maxLife: 0.15
          });
        }
      }

      // Move
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Ensure minimum speed based on ball type
      const curSpeed = Math.hypot(ball.vx, ball.vy);
      const targetSpeed = ball.baseSpeed * this.ballSpeedMultiplier;
      if (curSpeed > 0 && Math.abs(curSpeed - targetSpeed) > 10) {
        const factor = targetSpeed / curSpeed;
        ball.vx *= factor;
        ball.vy *= factor;
      }

      // Chamber Wall Collisions (Left, Right, Top, Bottom)
      let hitWall = false;

      // Left Wall
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
        ball.squashX = 0.7;
        ball.squashY = 1.3;
        hitWall = true;
      }
      // Right Wall
      else if (ball.x + ball.radius > this.width) {
        ball.x = this.width - ball.radius;
        ball.vx = -Math.abs(ball.vx);
        ball.squashX = 0.7;
        ball.squashY = 1.3;
        hitWall = true;
      }

      // Top Wall
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
        ball.squashX = 1.3;
        ball.squashY = 0.7;
        hitWall = true;
      }
      // Bottom Wall
      else if (ball.y + ball.radius > this.height) {
        ball.y = this.height - ball.radius;
        ball.vy = -Math.abs(ball.vy);
        ball.squashX = 1.3;
        ball.squashY = 0.7;
        hitWall = true;
      }

      if (hitWall) {
        if (ball.type === 'heavy') {
          sound.playSeismicStun();
        } else {
          sound.playWallBounce();
        }
      }

      // Flower Bumper Collisions
      for (const bumper of this.bumpers) {
        const bx = bumper.relX * this.width;
        const by = bumper.relY * this.height;
        const radius = bumper.baseRadius * this.bumperRadiusMultiplier;

        const dx = ball.x - bx;
        const dy = ball.y - by;
        const dist = Math.hypot(dx, dy);
        const minDist = ball.radius + radius;

        if (dist < minDist && dist > 0.001) {
          // Normal vector
          const nx = dx / dist;
          const ny = dy / dist;

          // Push out of collision
          ball.x = bx + nx * (minDist + 1);
          ball.y = by + ny * (minDist + 1);

          // Elastic reflection
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx = ball.vx - 2 * dot * nx;
            ball.vy = ball.vy - 2 * dot * ny;
          }

          // Trigger hit reaction on bumper
          bumper.scale = ball.type === 'heavy' ? 0.6 : 0.75;
          bumper.squashVel = ball.type === 'heavy' ? 18 : 12;

          // Spawn fluffy cloud puff on the flower
          this.puffs.push({
            x: bx,
            y: by,
            radius: radius * 0.6,
            maxRadius: radius * (ball.type === 'heavy' ? 2.0 : 1.5),
            alpha: 1.0,
            life: 0,
            maxLife: 0.35
          });

          // Play musical chime and signal attack
          sound.playBumperHit(bumper.id);
          this.onHitCallback(bumper.type, bumper.id, ball.type);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Chamber Background (Warm parchment / sand canvas)
    ctx.fillStyle = '#dbcca9';
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle paper grain dots
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    for (let i = 15; i < this.width; i += 40) {
      for (let j = 15; j < this.height; j += 40) {
        ctx.fillRect(i + ((j * 17) % 20), j, 2, 2);
      }
    }

    // Left border dividing line
    ctx.strokeStyle = '#225522';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, this.height);
    ctx.stroke();

    // 2. Render 5 Flower Bumpers
    for (const bumper of this.bumpers) {
      const bx = bumper.relX * this.width;
      const by = bumper.relY * this.height;
      const radius = bumper.baseRadius * this.bumperRadiusMultiplier * bumper.scale;

      this.renderFlower(ctx, bx, by, radius);
    }

    // 3. Render Particles (Fire & Lightning)
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 4. Render Cloud Puffs (Poofs when bumpers get hit)
    for (const puff of this.puffs) {
      this.renderCloudPuff(ctx, puff);
    }

    // 5. Render Bouncing Balls
    for (const ball of this.balls) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.scale(ball.squashX, ball.squashY);

      // Ball shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, ball.radius * 0.85, ball.radius, ball.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Custom Appearance per Ball Type
      if (ball.type === 'fire') {
        // Fireball: glowing orange aura with fiery core
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, ball.radius * 1.5);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, '#fde047');
        grad.addColorStop(0.7, '#ea580c');
        grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f97316';
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (ball.type === 'lightning') {
        // Lightning Ball: electric blue aura with bright white-cyan center
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, ball.radius * 1.4);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#38bdf8');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#082f49';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (ball.type === 'heavy') {
        // Heavy Iron Cannonball: Dark metallic with metal sheen
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Metallic highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(-ball.radius * 0.35, -ball.radius * 0.35, ball.radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard Ball (Clean white circle with thick black outline)
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // Draw hand-drawn 8-petal daisy matching the exact video art
  private renderFlower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.save();
    ctx.translate(x, y);

    const petalCount = 8;
    const petalDist = r * 0.65;
    const petalRadius = r * 0.46;

    // Outer Petals
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 3;

    for (let i = 0; i < petalCount; i++) {
      const angle = (i * Math.PI * 2) / petalCount;
      const px = Math.cos(angle) * petalDist;
      const py = Math.sin(angle) * petalDist;

      ctx.beginPath();
      ctx.arc(px, py, petalRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Yellow Center Disk
    const centerRadius = r * 0.48;
    ctx.fillStyle = '#f8ca20';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dotted stipple texture inside yellow center
    ctx.fillStyle = '#cc7a00';
    const dotOffsets = [
      [-0.15, -0.15], [0.15, -0.15], [0, 0], [-0.2, 0.15], [0.2, 0.15],
      [-0.05, 0.25], [0.05, -0.25], [-0.25, 0], [0.25, 0]
    ];
    for (const [ox, oy] of dotOffsets) {
      ctx.beginPath();
      ctx.arc(ox * centerRadius * 2, oy * centerRadius * 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Draw fluffy white comic cloud puff
  private renderCloudPuff(ctx: CanvasRenderingContext2D, puff: CloudPuff) {
    ctx.save();
    ctx.translate(puff.x, puff.y);
    ctx.globalAlpha = puff.alpha;

    ctx.fillStyle = '#fcfcfc';
    ctx.strokeStyle = '#d6d6d6';
    ctx.lineWidth = 2;

    const r = puff.radius;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      const px = Math.cos(a) * (r * 0.55);
      const py = Math.sin(a) * (r * 0.55);
      ctx.beginPath();
      ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Center fill
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
