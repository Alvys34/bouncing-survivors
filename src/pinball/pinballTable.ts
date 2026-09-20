import { sound } from '../audio';

export type PinballBallType = 'standard' | 'lightning' | 'fire' | 'golem';

export interface PinballBall {
  id: number;
  type: PinballBallType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface Bumper {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: 'tesla' | 'flames' | 'mortar';
  color: string;
  glowColor: string;
  label: string;
  scale: number;
  squashVel: number;
}

export interface Slingshot {
  side: 'left' | 'right';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  flashTimer: number;
}

export interface DropTarget {
  id: number;
  letter: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDown: boolean;
}

export interface TableParticle {
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

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export class PinballTable {
  public width: number = 0;
  public height: number = 0;

  // Balls & State
  public balls: PinballBall[] = [];
  public score: number = 0;
  public comboMultiplier: number = 1.0;
  public comboStreak: number = 0;
  public comboTimer: number = 0;
  private nextBallId: number = 1;

  // Plunger
  public isChargingPlunger: boolean = false;
  public plungerTension: number = 0; // 0..1
  public plungerWidth: number = 44;

  // Flippers
  public leftFlipper = {
    pivotX: 0,
    pivotY: 0,
    length: 86,
    angle: 0.52, // ~30 deg
    restAngle: 0.52,
    upAngle: -0.42, // ~-24 deg
    angularVel: 0,
    isPressed: false
  };

  public rightFlipper = {
    pivotX: 0,
    pivotY: 0,
    length: 86,
    angle: Math.PI - 0.52,
    restAngle: Math.PI - 0.52,
    upAngle: Math.PI + 0.42,
    angularVel: 0,
    isPressed: false
  };

  // Table Components
  public bumpers: Bumper[] = [];
  public slingshots: Slingshot[] = [];
  public dropTargets: DropTarget[] = [];
  public particles: TableParticle[] = [];
  public floatTexts: FloatingText[] = [];

  // Upgrades
  public bumperForceMultiplier: number = 1.0;
  public flipperPowerMultiplier: number = 1.0;

  private onTriggerCallback: (
    type: 'tesla' | 'flames' | 'mortar' | 'nuke',
    ballType: PinballBallType,
    combo: number
  ) => void;

  constructor(
    onTrigger: (
      type: 'tesla' | 'flames' | 'mortar' | 'nuke',
      ballType: PinballBallType,
      combo: number
    ) => void
  ) {
    this.onTriggerCallback = onTrigger;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.initTableComponents();
    if (this.balls.length === 0) {
      this.spawnBallInPlunger('standard');
    }
  }

  private initTableComponents() {
    const w = this.width;
    const h = this.height;
    const playW = w - this.plungerWidth;

    // 1. Dual Flippers Setup
    const flipperY = h * 0.90;
    const flipperGap = 92;
    this.leftFlipper.pivotX = playW * 0.5 - flipperGap * 0.5 - 20;
    this.leftFlipper.pivotY = flipperY;
    this.rightFlipper.pivotX = playW * 0.5 + flipperGap * 0.5 + 20;
    this.rightFlipper.pivotY = flipperY;

    // 2. Bumpers Setup
    // West Cluster (Tesla - Cyan)
    this.bumpers = [
      {
        id: 'west_1',
        x: playW * 0.22,
        y: h * 0.24,
        radius: 34,
        type: 'tesla',
        color: '#0284c7',
        glowColor: '#38bdf8',
        label: '⚡ TESLA',
        scale: 1,
        squashVel: 0
      },
      {
        id: 'west_2',
        x: playW * 0.35,
        y: h * 0.33,
        radius: 34,
        type: 'tesla',
        color: '#0284c7',
        glowColor: '#38bdf8',
        label: '⚡ TESLA',
        scale: 1,
        squashVel: 0
      },
      // East Cluster (Flames - Orange)
      {
        id: 'east_1',
        x: playW * 0.78,
        y: h * 0.24,
        radius: 34,
        type: 'flames',
        color: '#ea580c',
        glowColor: '#fb923c',
        label: '🔥 FIRE',
        scale: 1,
        squashVel: 0
      },
      {
        id: 'east_2',
        x: playW * 0.65,
        y: h * 0.33,
        radius: 34,
        type: 'flames',
        color: '#ea580c',
        glowColor: '#fb923c',
        label: '🔥 FIRE',
        scale: 1,
        squashVel: 0
      },
      // Center Nova / Mortar Bumper
      {
        id: 'center_mortar',
        x: playW * 0.50,
        y: h * 0.20,
        radius: 40,
        type: 'mortar',
        color: '#9333ea',
        glowColor: '#c084fc',
        label: '💥 MORTAR',
        scale: 1,
        squashVel: 0
      }
    ];

    // 3. Slingshots (Triangular kickers)
    this.slingshots = [
      {
        side: 'left',
        x1: playW * 0.16,
        y1: h * 0.72,
        x2: playW * 0.28,
        y2: h * 0.82,
        x3: playW * 0.16,
        y3: h * 0.83,
        flashTimer: 0
      },
      {
        side: 'right',
        x1: playW * 0.84,
        y1: h * 0.72,
        x2: playW * 0.72,
        y2: h * 0.82,
        x3: playW * 0.84,
        y3: h * 0.83,
        flashTimer: 0
      }
    ];

    // 4. S-P-E-L-L Drop Targets
    this.dropTargets = [];
    const letters = ['S', 'P', 'E', 'L', 'L'];
    const targetW = 28;
    const targetGap = 12;
    const startX = playW * 0.5 - (letters.length * (targetW + targetGap)) * 0.5;
    letters.forEach((l, idx) => {
      this.dropTargets.push({
        id: idx,
        letter: l,
        x: startX + idx * (targetW + targetGap),
        y: h * 0.46,
        width: targetW,
        height: 18,
        isDown: false
      });
    });
  }

  public spawnBallInPlunger(type: PinballBallType = 'standard') {
    const px = this.width - this.plungerWidth * 0.5;
    const py = this.height * 0.88;

    this.balls.push({
      id: this.nextBallId++,
      type,
      x: px,
      y: py,
      vx: 0,
      vy: 0,
      radius: 12
    });
  }

  public addMultiball(count: number = 2) {
    for (let i = 0; i < count; i++) {
      const types: PinballBallType[] = ['lightning', 'fire', 'golem', 'standard'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      const b: PinballBall = {
        id: this.nextBallId++,
        type: chosenType,
        x: (this.width - this.plungerWidth) * (0.3 + Math.random() * 0.4),
        y: this.height * 0.25,
        vx: (Math.random() - 0.5) * 450,
        vy: -150 - Math.random() * 200,
        radius: 12
      };
      this.balls.push(b);
    }
    sound.playComboMilestone();
    this.addFloatingText('🔥 MULTIBALL FRENZY!', this.width * 0.45, this.height * 0.4, '#ffd54f');
  }

  // Flipper Inputs
  public setLeftFlipper(pressed: boolean) {
    if (pressed && !this.leftFlipper.isPressed) {
      sound.playFlipper();
    }
    this.leftFlipper.isPressed = pressed;
  }

  public setRightFlipper(pressed: boolean) {
    if (pressed && !this.rightFlipper.isPressed) {
      sound.playFlipper();
    }
    this.rightFlipper.isPressed = pressed;
  }

  // Plunger Tension (Spacebar hold/release)
  public startChargingPlunger() {
    this.isChargingPlunger = true;
  }

  public releasePlunger() {
    if (!this.isChargingPlunger && this.plungerTension <= 0) return;
    this.isChargingPlunger = false;

    // Check if any ball is currently in plunger lane
    const playW = this.width - this.plungerWidth;
    let launched = false;
    for (const b of this.balls) {
      if (b.x > playW && b.y > this.height * 0.6) {
        const force = 650 + this.plungerTension * 1100;
        b.vy = -force;
        b.vx = -40; // curve into top arch
        launched = true;
      }
    }

    if (launched) {
      sound.playPlungerRelease();
    }
    this.plungerTension = 0;
  }

  public update(dt: number) {
    // 1. Plunger tension charge
    if (this.isChargingPlunger) {
      this.plungerTension = Math.min(1.0, this.plungerTension + dt * 1.8);
    }

    // 2. Flipper Physics & Animation
    this.updateFlippers(dt);

    // 3. Combo Timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        // Combo gently scales down rather than hard reset
        this.comboMultiplier = Math.max(1.0, this.comboMultiplier - 0.5);
        if (this.comboMultiplier > 1.0) this.comboTimer = 2.0;
      }
    }

    // 4. Update Bumpers Squash Animation
    for (const b of this.bumpers) {
      const force = (1.0 - b.scale) * 45;
      b.squashVel += force * dt;
      b.squashVel *= Math.pow(0.85, dt * 60);
      b.scale += b.squashVel * dt;
    }

    // 5. Update Slingshots flash
    for (const s of this.slingshots) {
      if (s.flashTimer > 0) s.flashTimer -= dt;
    }

    // 6. Substep Ball Simulation for ultra-precise high-speed collision
    const substeps = 4;
    const subDt = dt / substeps;
    for (let step = 0; step < substeps; step++) {
      this.updateBallPhysics(subDt);
    }

    // 7. Update Particles & Text
    this.updateFX(dt);
  }

  private updateFlippers(dt: number) {
    const flipSpeed = 36 * this.flipperPowerMultiplier;

    // Left Flipper
    const targetLeft = this.leftFlipper.isPressed ? this.leftFlipper.upAngle : this.leftFlipper.restAngle;
    const dLeft = targetLeft - this.leftFlipper.angle;
    this.leftFlipper.angularVel = dLeft * flipSpeed;
    this.leftFlipper.angle += this.leftFlipper.angularVel * dt;

    // Right Flipper
    const targetRight = this.rightFlipper.isPressed ? this.rightFlipper.upAngle : this.rightFlipper.restAngle;
    const dRight = targetRight - this.rightFlipper.angle;
    this.rightFlipper.angularVel = dRight * flipSpeed;
    this.rightFlipper.angle += this.rightFlipper.angularVel * dt;
  }

  private updateBallPhysics(dt: number) {
    const playW = this.width - this.plungerWidth;
    const gravityY = 980;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      // Gravity slope
      b.vy += gravityY * dt;

      // Ball trails
      if (b.type === 'lightning') {
        if (Math.random() < 0.4) {
          this.particles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 50,
            vy: (Math.random() - 0.5) * 50,
            size: 3,
            color: '#38bdf8',
            alpha: 0.9,
            life: 0,
            maxLife: 0.15
          });
        }
      } else if (b.type === 'fire') {
        if (Math.random() < 0.5) {
          this.particles.push({
            x: b.x,
            y: b.y,
            vx: -b.vx * 0.1 + (Math.random() - 0.5) * 30,
            vy: -b.vy * 0.1 - Math.random() * 30,
            size: 4 + Math.random() * 4,
            color: Math.random() > 0.4 ? '#f97316' : '#fde047',
            alpha: 0.9,
            life: 0,
            maxLife: 0.25
          });
        }
      }

      // Move
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Cap speed
      const spd = Math.hypot(b.vx, b.vy);
      const maxSpeed = b.type === 'lightning' ? 1800 : 1500;
      if (spd > maxSpeed) {
        b.vx = (b.vx / spd) * maxSpeed;
        b.vy = (b.vy / spd) * maxSpeed;
      }

      // 1. Boundary & Top Arch Collisions
      // Far right wall of plunger lane
      if (b.x + b.radius > this.width) {
        b.x = this.width - b.radius;
        b.vx = -Math.abs(b.vx) * 0.8;
      }

      // Left Table Wall
      if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.vx = Math.abs(b.vx) * 0.8;
      }

      // Divider Wall between playfield and plunger lane
      if (b.y > this.height * 0.22 && b.x + b.radius > playW && b.x - b.radius < playW) {
        if (b.vx > 0 && b.x < playW) {
          b.x = playW - b.radius;
          b.vx = -Math.abs(b.vx) * 0.8;
        } else if (b.vx < 0 && b.x > playW) {
          b.x = playW + b.radius;
          b.vx = Math.abs(b.vx) * 0.8;
        }
      }

      // Top Wall & Arch (Channels ball from plunger into playfield)
      if (b.y - b.radius < 0) {
        b.y = b.radius;
        b.vy = Math.abs(b.vy) * 0.85;
        if (b.x > playW * 0.8) {
          b.vx -= 180; // Deflect to the left
        }
      }

      // Inlane side guides (deflect ball into flippers)
      const guideY = this.height * 0.84;
      if (b.y > guideY && b.y < this.height * 0.94) {
        // Left guide slope
        const leftGuideX = (b.y - guideY) * 0.7;
        if (b.x - b.radius < leftGuideX) {
          b.x = leftGuideX + b.radius;
          b.vx = Math.abs(b.vx) * 0.9 + 50;
        }
        // Right guide slope
        const rightGuideX = playW - (b.y - guideY) * 0.7;
        if (b.x + b.radius > rightGuideX && b.x < playW) {
          b.x = rightGuideX - b.radius;
          b.vx = -Math.abs(b.vx) * 0.9 - 50;
        }
      }

      // 2. Slingshots Collisions
      for (const s of this.slingshots) {
        // Check hypotenuse line segment (x1, y1) to (x2, y2)
        const hit = this.checkLineCollision(b, s.x1, s.y1, s.x2, s.y2, 1.4);
        if (hit) {
          s.flashTimer = 0.12;
          sound.playSlingshot();
          this.score += 50 * this.comboMultiplier;
          this.comboTimer = 3.5;
          // Spawn sparks
          for (let p = 0; p < 6; p++) {
            this.particles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 200,
              vy: (Math.random() - 0.5) * 200,
              size: 3,
              color: '#34d399',
              alpha: 1,
              life: 0,
              maxLife: 0.2
            });
          }
        }
      }

      // 3. Bumpers Collisions
      for (const bumper of this.bumpers) {
        const dx = b.x - bumper.x;
        const dy = b.y - bumper.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b.radius + bumper.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push out
          b.x = bumper.x + nx * (minDist + 1);
          b.y = bumper.y + ny * (minDist + 1);

          // Violent bounce impulse
          const bounceForce = 680 * this.bumperForceMultiplier;
          b.vx = nx * bounceForce + (Math.random() - 0.5) * 60;
          b.vy = ny * bounceForce + (Math.random() - 0.5) * 60;

          bumper.scale = 0.7;
          bumper.squashVel = 18;

          // Combo progression
          this.comboStreak++;
          this.comboMultiplier = Math.min(10.0, 1.0 + Math.floor(this.comboStreak / 3) * 0.5);
          this.comboTimer = 3.5;
          const pts = (bumper.type === 'mortar' ? 250 : 150) * this.comboMultiplier;
          this.score += Math.floor(pts);

          sound.playBumperHit(bumper.type === 'mortar' ? 1046.5 : 784);
          this.onTriggerCallback(bumper.type, b.type, this.comboMultiplier);

          // Spawn burst particles
          for (let p = 0; p < 10; p++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 80 + Math.random() * 160;
            this.particles.push({
              x: bumper.x + nx * bumper.radius,
              y: bumper.y + ny * bumper.radius,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              size: 4 + Math.random() * 3,
              color: bumper.glowColor,
              alpha: 1.0,
              life: 0,
              maxLife: 0.3
            });
          }

          if (this.comboStreak % 5 === 0) {
            this.addFloatingText(`x${this.comboMultiplier.toFixed(1)} COMBO!`, bumper.x, bumper.y - 20, '#facc15');
          }
        }
      }

      // 4. Drop Targets Collisions
      for (const t of this.dropTargets) {
        if (t.isDown) continue;
        if (
          b.x + b.radius > t.x &&
          b.x - b.radius < t.x + t.width &&
          b.y + b.radius > t.y &&
          b.y - b.radius < t.y + t.height
        ) {
          t.isDown = true;
          b.vy = -Math.abs(b.vy) * 0.85;
          sound.playDropTarget(t.id);
          this.score += 300 * this.comboMultiplier;

          // Check if all are down!
          const allDown = this.dropTargets.every(dt => dt.isDown);
          if (allDown) {
            sound.playNuke();
            this.score += 2500 * this.comboMultiplier;
            this.addFloatingText('💥 FULL SCREEN NUKE!', playW * 0.5, this.height * 0.45, '#ef4444');
            this.onTriggerCallback('nuke', b.type, this.comboMultiplier);

            // Reset targets after 2s
            setTimeout(() => {
              this.dropTargets.forEach(dt => (dt.isDown = false));
            }, 2000);
          }
        }
      }

      // 5. Flippers Collision & Angular Strike Impulse
      this.checkFlipperCollision(b, this.leftFlipper, 1);
      this.checkFlipperCollision(b, this.rightFlipper, -1);

      // 6. DRAIN DETECTION (Never Game Over - Only Combo Reset!)
      if (b.y > this.height + 25) {
        // Punish player by resetting combo!
        sound.playDrain();
        this.comboMultiplier = 1.0;
        this.comboStreak = 0;
        this.comboTimer = 0;
        this.addFloatingText('COMBO RESET!', playW * 0.5, this.height * 0.85, '#ef4444');

        // Remove drained ball
        this.balls.splice(i, 1);

        // If no balls remaining, immediately respawn one in the plunger!
        if (this.balls.length === 0) {
          this.spawnBallInPlunger('standard');
        }
      }
    }
  }

  // Flipper segment collision with angular kickback
  private checkFlipperCollision(b: PinballBall, flipper: typeof this.leftFlipper, dir: number) {
    const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
    const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;

    // Vector from pivot to tip
    const fx = tipX - flipper.pivotX;
    const fy = tipY - flipper.pivotY;
    const lenSq = fx * fx + fy * fy;

    // Vector from pivot to ball
    const bx = b.x - flipper.pivotX;
    const by = b.y - flipper.pivotY;

    // Projection scalar t
    let t = (bx * fx + by * fy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    // Closest point on flipper
    const closeX = flipper.pivotX + t * fx;
    const closeY = flipper.pivotY + t * fy;

    const dx = b.x - closeX;
    const dy = b.y - closeY;
    const dist = Math.hypot(dx, dy);

    if (dist < b.radius + 7) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      // Push ball out
      b.x = closeX + nx * (b.radius + 8);
      b.y = closeY + ny * (b.radius + 8);

      // Normal reflection
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx -= 1.8 * dot * nx;
        b.vy -= 1.8 * dot * ny;
      }

      // Add angular velocity impulse if flipper is moving
      if (flipper.isPressed) {
        const linearSpeed = Math.abs(flipper.angularVel) * t * flipper.length;
        const flipperNormalX = -Math.sin(flipper.angle) * dir;
        const flipperNormalY = Math.cos(flipper.angle) * dir;

        b.vx += flipperNormalX * linearSpeed * 0.95;
        b.vy += flipperNormalY * linearSpeed * 0.95;

        // Extra upward impulse to launch up the table
        b.vy -= 450 * this.flipperPowerMultiplier;
      }
    }
  }

  // Line segment collision helper for slingshots & rails
  private checkLineCollision(b: PinballBall, x1: number, y1: number, x2: number, y2: number, bounceMult: number = 1.0): boolean {
    const lx = x2 - x1;
    const ly = y2 - y1;
    const lenSq = lx * lx + ly * ly;

    const bx = b.x - x1;
    const by = b.y - y1;
    let t = (bx * lx + by * ly) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const cx = x1 + t * lx;
    const cy = y1 + t * ly;
    const dx = b.x - cx;
    const dy = b.y - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < b.radius + 4) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      b.x = cx + nx * (b.radius + 5);
      b.y = cy + ny * (b.radius + 5);

      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx = (b.vx - 2 * dot * nx) * bounceMult;
        b.vy = (b.vy - 2 * dot * ny) * bounceMult;
      }
      return true;
    }
    return false;
  }

  private updateFX(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const t = this.floatTexts[i];
      t.life += dt;
      t.y += t.vy * dt;
      t.alpha = Math.max(0, 1 - t.life / t.maxLife);
      if (t.life >= t.maxLife) this.floatTexts.splice(i, 1);
    }
  }

  public addFloatingText(text: string, x: number, y: number, color: string = '#ffd54f') {
    this.floatTexts.push({
      text,
      x,
      y,
      vy: -55,
      color,
      alpha: 1.0,
      life: 0,
      maxLife: 0.9
    });
  }

  public render(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) {
    ctx.save();
    ctx.translate(offsetX, offsetY);

    const playW = this.width - this.plungerWidth;

    // 1. Pinball Table Wood/Parchment Background
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ede3cc';
    ctx.fillRect(2, 2, this.width - 4, this.height - 4);

    // Decorative table art & runes
    ctx.strokeStyle = '#c4b595';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(playW * 0.5, this.height * 0.28, 140, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Plunger Lane Border & Spring
    ctx.fillStyle = '#d6c8a7';
    ctx.fillRect(playW, 0, this.plungerWidth, this.height);

    ctx.strokeStyle = '#3e3422';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(playW, this.height * 0.22);
    ctx.lineTo(playW, this.height);
    ctx.stroke();

    // Spring Plunger Coil at bottom of lane
    const springY = this.height * 0.92;
    const compress = this.plungerTension * 32;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(playW + 8, springY + compress, this.plungerWidth - 16, 24);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(playW + 8, springY + compress, this.plungerWidth - 16, 24);

    // 3. Drop Targets S-P-E-L-L
    for (const t of this.dropTargets) {
      if (!t.isDown) {
        ctx.fillStyle = '#e11d48';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;
        ctx.fillRect(t.x, t.y, t.width, t.height);
        ctx.strokeRect(t.x, t.y, t.width, t.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.letter, t.x + t.width * 0.5, t.y + t.height * 0.5);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(t.x, t.y, t.width, t.height);
      }
    }

    // 4. Slingshots
    for (const s of this.slingshots) {
      ctx.fillStyle = s.flashTimer > 0 ? '#6ee7b7' : '#059669';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.lineTo(s.x3, s.y3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 5. Bumpers
    for (const b of this.bumpers) {
      const r = b.radius * b.scale;
      ctx.save();
      ctx.translate(b.x, b.y);

      // Glow halo
      ctx.fillStyle = b.glowColor + '44';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Outer Ring
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#151515';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner Core
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, 0, 0);

      ctx.restore();
    }

    // 6. Flippers
    this.renderFlipper(ctx, this.leftFlipper);
    this.renderFlipper(ctx, this.rightFlipper);

    // 7. Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 8. Balls
    for (const b of this.balls) {
      this.renderBall(ctx, b);
    }

    // 9. Floating Combo Text
    for (const t of this.floatTexts) {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.alpha;
      ctx.font = 'black 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1.0;
    }

    // 10. Table Top Score & Combo Bar
    ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
    ctx.fillRect(6, 6, playW - 12, 28);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, playW - 12, 28);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SCORE: ${this.score.toLocaleString()}`, 16, 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.comboMultiplier > 1.0 ? '#4ade80' : '#9ca3af';
    ctx.fillText(`COMBO: x${this.comboMultiplier.toFixed(1)}`, playW - 16, 20);

    ctx.restore();
  }

  private renderFlipper(ctx: CanvasRenderingContext2D, f: typeof this.leftFlipper) {
    ctx.save();
    ctx.translate(f.pivotX, f.pivotY);
    ctx.rotate(f.angle);

    // Flipper Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(0, -6 + 5, f.length, 14, 7);
    ctx.fill();

    // Flipper Body (Vibrant Red)
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(0, -7, f.length, 14, 7);
    ctx.fill();
    ctx.stroke();

    // Pivot Bushing / Bearing
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private renderBall(ctx: CanvasRenderingContext2D, b: PinballBall) {
    ctx.save();
    ctx.translate(b.x, b.y);

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, b.radius * 0.7, b.radius, b.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (b.type === 'lightning') {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0369a1';
    } else if (b.type === 'fire') {
      ctx.fillStyle = '#f97316';
      ctx.strokeStyle = '#9a3412';
    } else if (b.type === 'golem') {
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#0f172a';
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0f172a';
    }

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ball reflection highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-b.radius * 0.3, -b.radius * 0.3, b.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
