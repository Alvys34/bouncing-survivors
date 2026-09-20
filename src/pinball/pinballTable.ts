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

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bounce: number;
  color?: string;
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

  // Flippers (Classic Pinball dual flippers)
  public leftFlipper = {
    pivotX: 0,
    pivotY: 0,
    length: 88,
    angle: 0.50, // ~28.6 deg rest angle down
    restAngle: 0.50,
    upAngle: -0.42, // ~-24 deg stroke angle
    angularVel: 0,
    isPressed: false
  };

  public rightFlipper = {
    pivotX: 0,
    pivotY: 0,
    length: 88,
    angle: Math.PI - 0.50,
    restAngle: Math.PI - 0.50,
    upAngle: Math.PI + 0.42,
    angularVel: 0,
    isPressed: false
  };

  // Table Components
  public walls: WallSegment[] = [];
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

    // 1. Dual Flippers Setup (Classic spacing & downward angles)
    const flipperY = h * 0.88;
    const flipperSpacing = 110;
    this.leftFlipper.pivotX = playW * 0.5 - flipperSpacing;
    this.leftFlipper.pivotY = flipperY;
    this.rightFlipper.pivotX = playW * 0.5 + flipperSpacing;
    this.rightFlipper.pivotY = flipperY;

    // 2. Pop Bumper Triangle Cluster (Classic Pinball upper-field layout)
    this.bumpers = [
      // Top-Left: West Tesla Spire (Cyan)
      {
        id: 'west_tesla',
        x: playW * 0.38,
        y: h * 0.24,
        radius: 36,
        type: 'tesla',
        color: '#0284c7',
        glowColor: '#38bdf8',
        label: '⚡ TESLA',
        scale: 1,
        squashVel: 0
      },
      // Top-Right: East Flame Spire (Orange)
      {
        id: 'east_flames',
        x: playW * 0.64,
        y: h * 0.24,
        radius: 36,
        type: 'flames',
        color: '#ea580c',
        glowColor: '#fb923c',
        label: '🔥 FIRE',
        scale: 1,
        squashVel: 0
      },
      // Bottom-Center: Sky-Mortar (Purple)
      {
        id: 'center_mortar',
        x: playW * 0.51,
        y: h * 0.36,
        radius: 42,
        type: 'mortar',
        color: '#9333ea',
        glowColor: '#c084fc',
        label: '💥 MORTAR',
        scale: 1,
        squashVel: 0
      }
    ];

    // 3. Slingshots (Triangular active rubber kickers above each flipper)
    this.slingshots = [
      {
        side: 'left',
        x1: playW * 0.27,
        y1: h * 0.69,
        x2: playW * 0.35,
        y2: h * 0.81,
        x3: playW * 0.21,
        y3: h * 0.81,
        flashTimer: 0
      },
      {
        side: 'right',
        x1: playW * 0.73,
        y1: h * 0.69,
        x2: playW * 0.65,
        y2: h * 0.81,
        x3: playW * 0.79,
        y3: h * 0.81,
        flashTimer: 0
      }
    ];

    // 4. S-P-E-L-L Drop Targets (Classic Left-Bank Vertical Setup)
    this.dropTargets = [];
    const letters = ['S', 'P', 'E', 'L', 'L'];
    const targetW = 16;
    const targetH = 26;
    const targetGap = 12;
    const startY = h * 0.38;
    const targetX = playW * 0.12;

    letters.forEach((l, idx) => {
      this.dropTargets.push({
        id: idx,
        letter: l,
        x: targetX,
        y: startY + idx * (targetH + targetGap),
        width: targetW,
        height: targetH,
        isDown: false
      });
    });

    // 5. Physical Wall Geometry (Arch, Shooter Lane, Inlanes, Outlanes, Apron)
    this.walls = [];

    // Outer Left Wall
    this.walls.push({ x1: 20, y1: 140, x2: 20, y2: h * 0.68, bounce: 0.85 });

    // Outer Right Wall (Shooter Lane Outer Boundary)
    this.walls.push({ x1: w - 12, y1: 140, x2: w - 12, y2: h * 0.95, bounce: 0.85 });

    // Shooter Lane Divider Wall (separates playfield from shooter lane)
    this.walls.push({ x1: playW, y1: 140, x2: playW, y2: h * 0.84, bounce: 0.85 });

    // Top Arch Curved Polyline (Directs launched ball smoothly from shooter lane over table)
    const archPoints = [
      { x: w - 12, y: 140 },
      { x: w - 16, y: 95 },
      { x: w - 32, y: 62 },
      { x: playW - 4, y: 38 },
      { x: playW * 0.76, y: 22 },
      { x: playW * 0.50, y: 18 },
      { x: playW * 0.24, y: 22 },
      { x: 55, y: 38 },
      { x: 32, y: 68 },
      { x: 20, y: 105 },
      { x: 20, y: 140 }
    ];

    for (let i = 0; i < archPoints.length - 1; i++) {
      this.walls.push({
        x1: archPoints[i].x,
        y1: archPoints[i].y,
        x2: archPoints[i + 1].x,
        y2: archPoints[i + 1].y,
        bounce: 0.88
      });
    }

    // Top Rollover Lane Divider Guides (Funnel balls into Bumper Triangle)
    this.walls.push({ x1: playW * 0.30, y1: 110, x2: playW * 0.30, y2: 175, bounce: 0.7 });
    this.walls.push({ x1: playW * 0.44, y1: 100, x2: playW * 0.44, y2: 165, bounce: 0.7 });
    this.walls.push({ x1: playW * 0.58, y1: 100, x2: playW * 0.58, y2: 165, bounce: 0.7 });
    this.walls.push({ x1: playW * 0.72, y1: 110, x2: playW * 0.72, y2: 175, bounce: 0.7 });

    // Drop Target Backstop Wall (behind S-P-E-L-L bank)
    this.walls.push({ x1: playW * 0.08, y1: startY - 10, x2: playW * 0.08, y2: startY + letters.length * (targetH + targetGap), bounce: 0.8 });

    // Lower Playfield: Left Inlane & Outlane Guide Walls
    this.walls.push({ x1: playW * 0.16, y1: h * 0.68, x2: playW * 0.18, y2: h * 0.83, bounce: 0.85 }); // Inlane divider
    this.walls.push({ x1: 20, y1: h * 0.68, x2: playW * 0.08, y2: h * 0.83, bounce: 0.85 }); // Outlane left outer guide

    // Lower Playfield: Right Inlane & Outlane Guide Walls
    this.walls.push({ x1: playW * 0.84, y1: h * 0.68, x2: playW * 0.82, y2: h * 0.83, bounce: 0.85 }); // Inlane divider
    this.walls.push({ x1: playW, y1: h * 0.68, x2: playW * 0.92, y2: h * 0.83, bounce: 0.85 }); // Outlane right outer guide

    // Bottom Apron Angled Funnel Walls (sloped toward flipper pivots & drain)
    this.walls.push({ x1: playW * 0.08, y1: h * 0.83, x2: this.leftFlipper.pivotX - 10, y2: flipperY + 14, bounce: 0.8 });
    this.walls.push({ x1: playW * 0.92, y1: h * 0.83, x2: this.rightFlipper.pivotX + 10, y2: flipperY + 14, bounce: 0.8 });

    // Slingshot Back Walls (non-rubber faces)
    this.walls.push({ x1: playW * 0.21, y1: h * 0.81, x2: playW * 0.27, y2: h * 0.69, bounce: 0.8 });
    this.walls.push({ x1: playW * 0.79, y1: h * 0.81, x2: playW * 0.73, y2: h * 0.69, bounce: 0.8 });
  }

  // Spawns ball resting securely on the red square plunger tip
  public spawnBallInPlunger(type: PinballBallType = 'standard') {
    const px = this.width - this.plungerWidth * 0.5;
    const springRestY = this.height * 0.88;
    const py = springRestY - 12; // Sits directly on top of the red square

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
        x: (this.width - this.plungerWidth) * (0.35 + Math.random() * 0.3),
        y: this.height * 0.18,
        vx: (Math.random() - 0.5) * 450,
        vy: 120 + Math.random() * 150,
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

    const playW = this.width - this.plungerWidth;
    let launched = false;

    for (const b of this.balls) {
      // If ball is in the shooter lane
      if (b.x > playW - 5 && b.y > this.height * 0.5) {
        const force = 880 + this.plungerTension * 1320;
        b.vy = -force;
        b.vx = 0;
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
      this.plungerTension = Math.min(1.0, this.plungerTension + dt * 2.2);
    }

    // 2. Flipper Physics & Animation
    this.updateFlippers(dt);

    // 3. Combo Timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = Math.max(1.0, this.comboMultiplier - 0.5);
        if (this.comboMultiplier > 1.0) this.comboTimer = 2.0;
      }
    }

    // 4. Update Bumpers Squash Animation
    for (const b of this.bumpers) {
      const force = (1.0 - b.scale) * 55;
      b.squashVel += force * dt;
      b.squashVel *= Math.pow(0.82, dt * 60);
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
    const flipSpeed = 38 * this.flipperPowerMultiplier;

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

      // Ball visual trails
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

      // Cap max speed
      const spd = Math.hypot(b.vx, b.vy);
      const maxSpeed = b.type === 'lightning' ? 1900 : 1600;
      if (spd > maxSpeed) {
        b.vx = (b.vx / spd) * maxSpeed;
        b.vy = (b.vy / spd) * maxSpeed;
      }

      // -------------------------------------------------------------
      // 1. SHOOTER LANE FLOOR & PLUNGER TIP (RED SQUARE NEVER FALLS THROUGH!)
      // -------------------------------------------------------------
      if (b.x > playW - 5) {
        // Horizontally center ball in shooter lane
        const laneCenterX = playW + this.plungerWidth * 0.5;
        b.x = Math.max(playW + b.radius + 2, Math.min(this.width - b.radius - 12, b.x));

        // Plunger Red Square resting floor
        const springRestY = this.height * 0.88;
        const plateY = springRestY + this.plungerTension * 48;
        const floorY = plateY - b.radius;

        // The ball rests firmly on the red square tip and CANNOT fall through!
        if (b.y >= floorY) {
          b.y = floorY;
          b.vy = 0;
          b.vx = 0;
          b.x = laneCenterX;
        }

        // One-way exit at top of shooter lane:
        // Once ball reaches y < 140 and moves left into the arch, allow smooth entry to playfield!
        if (b.y < 140 && b.vy < 0) {
          b.vx -= 90; // curve leftward into top arch
        }
      } else {
        // Main playfield: prevent ball from re-entering shooter lane from the side
        if (b.y > 140 && b.x + b.radius > playW) {
          b.x = playW - b.radius;
          b.vx = -Math.abs(b.vx) * 0.85;
        }
      }

      // -------------------------------------------------------------
      // 2. STATIC PHYSICAL WALL SEGMENTS (Outer Arch, Guides, Apron)
      // -------------------------------------------------------------
      for (const wall of this.walls) {
        this.checkLineCollision(b, wall.x1, wall.y1, wall.x2, wall.y2, wall.bounce);
      }

      // -------------------------------------------------------------
      // 3. SLINGSHOTS (Triangular Active Kicking Rubbers)
      // -------------------------------------------------------------
      for (const s of this.slingshots) {
        // Hypotenuse is the active kicker face (x1, y1) to (x2, y2)
        const hit = this.checkLineCollision(b, s.x1, s.y1, s.x2, s.y2, 1.45);
        if (hit) {
          s.flashTimer = 0.14;
          sound.playSlingshot();
          this.score += 50 * this.comboMultiplier;
          this.comboTimer = 3.5;

          // Kick impulse away from the slingshot
          const kickDir = s.side === 'left' ? 1 : -1;
          b.vx += kickDir * 280;
          b.vy -= 220;

          // Sparks
          for (let p = 0; p < 7; p++) {
            this.particles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 220,
              vy: -Math.random() * 200,
              size: 3.5,
              color: '#34d399',
              alpha: 1,
              life: 0,
              maxLife: 0.22
            });
          }
        }
      }

      // -------------------------------------------------------------
      // 4. POP BUMPERS (Triangle Cluster - Powers Fortress Defenses)
      // -------------------------------------------------------------
      for (const bumper of this.bumpers) {
        const dx = b.x - bumper.x;
        const dy = b.y - bumper.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b.radius + bumper.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push ball out of bumper radius
          b.x = bumper.x + nx * (minDist + 1);
          b.y = bumper.y + ny * (minDist + 1);

          // Violent bounce impulse
          const bounceForce = 720 * this.bumperForceMultiplier;
          b.vx = nx * bounceForce + (Math.random() - 0.5) * 60;
          b.vy = ny * bounceForce + (Math.random() - 0.5) * 60;

          bumper.scale = 0.65;
          bumper.squashVel = 22;

          // Combo progression
          this.comboStreak++;
          this.comboMultiplier = Math.min(10.0, 1.0 + Math.floor(this.comboStreak / 3) * 0.5);
          this.comboTimer = 3.5;
          const pts = (bumper.type === 'mortar' ? 250 : 150) * this.comboMultiplier;
          this.score += Math.floor(pts);

          sound.playBumperHit(bumper.type === 'mortar' ? 1046.5 : (bumper.type === 'flames' ? 880 : 784));
          this.onTriggerCallback(bumper.type, b.type, this.comboMultiplier);

          // Burst particles
          for (let p = 0; p < 12; p++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 90 + Math.random() * 180;
            this.particles.push({
              x: bumper.x + nx * bumper.radius,
              y: bumper.y + ny * bumper.radius,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              size: 4 + Math.random() * 3,
              color: bumper.glowColor,
              alpha: 1.0,
              life: 0,
              maxLife: 0.32
            });
          }

          if (this.comboStreak % 4 === 0) {
            this.addFloatingText(`x${this.comboMultiplier.toFixed(1)} COMBO!`, bumper.x, bumper.y - 24, '#facc15');
          }
        }
      }

      // -------------------------------------------------------------
      // 5. DROP TARGETS (S-P-E-L-L Bank on Left)
      // -------------------------------------------------------------
      for (const t of this.dropTargets) {
        if (t.isDown) continue;
        if (
          b.x + b.radius > t.x &&
          b.x - b.radius < t.x + t.width &&
          b.y + b.radius > t.y &&
          b.y - b.radius < t.y + t.height
        ) {
          t.isDown = true;
          b.vx = Math.abs(b.vx) * 0.85 + 40; // Deflect back toward center
          b.vy *= 0.9;
          sound.playDropTarget(t.id);
          this.score += 300 * this.comboMultiplier;

          // Check if all S-P-E-L-L are down!
          const allDown = this.dropTargets.every(dt => dt.isDown);
          if (allDown) {
            sound.playNuke();
            this.score += 2500 * this.comboMultiplier;
            this.addFloatingText('💥 FULL SCREEN NUKE!', playW * 0.5, this.height * 0.45, '#ef4444');
            this.onTriggerCallback('nuke', b.type, this.comboMultiplier);

            // Reset targets after 2.5s
            setTimeout(() => {
              this.dropTargets.forEach(dt => (dt.isDown = false));
            }, 2500);
          }
        }
      }

      // -------------------------------------------------------------
      // 6. DUAL FLIPPERS (Angular Strike & Impulse)
      // -------------------------------------------------------------
      this.checkFlipperCollision(b, this.leftFlipper, 1);
      this.checkFlipperCollision(b, this.rightFlipper, -1);

      // -------------------------------------------------------------
      // 7. DRAIN DETECTION (Below Flippers into Bottom Trough)
      // -------------------------------------------------------------
      // Ball drains through the outlanes or between flippers
      const drainThreshold = this.height * 0.94;
      if (b.y > drainThreshold) {
        this.balls.splice(i, 1);

        // If no balls remaining, reset combo & immediately reload plunger
        if (this.balls.length === 0) {
          sound.playDrain();
          this.comboMultiplier = 1.0;
          this.comboStreak = 0;
          this.comboTimer = 0;
          this.addFloatingText('COMBO RESET!', playW * 0.5, this.height * 0.88, '#ef4444');
          this.spawnBallInPlunger('standard');
        } else {
          this.addFloatingText('BALL LOST', playW * 0.5, this.height * 0.88, '#94a3b8');
        }
      }
    }
  }

  // Flipper segment collision with angular kickback
  private checkFlipperCollision(b: PinballBall, flipper: typeof this.leftFlipper, dir: number) {
    const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
    const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;

    const fx = tipX - flipper.pivotX;
    const fy = tipY - flipper.pivotY;
    const lenSq = fx * fx + fy * fy;

    const bx = b.x - flipper.pivotX;
    const by = b.y - flipper.pivotY;

    let t = (bx * fx + by * fy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closeX = flipper.pivotX + t * fx;
    const closeY = flipper.pivotY + t * fy;

    const dx = b.x - closeX;
    const dy = b.y - closeY;
    const dist = Math.hypot(dx, dy);

    if (dist < b.radius + 7) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      b.x = closeX + nx * (b.radius + 8);
      b.y = closeY + ny * (b.radius + 8);

      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx -= 1.8 * dot * nx;
        b.vy -= 1.8 * dot * ny;
      }

      if (flipper.isPressed) {
        const linearSpeed = Math.abs(flipper.angularVel) * t * flipper.length;
        const flipperNormalX = -Math.sin(flipper.angle) * dir;
        const flipperNormalY = Math.cos(flipper.angle) * dir;

        b.vx += flipperNormalX * linearSpeed * 0.95;
        b.vy += flipperNormalY * linearSpeed * 0.95;

        // Upward launch impulse
        b.vy -= 460 * this.flipperPowerMultiplier;
      }
    }
  }

  // Line segment collision helper for static walls & slingshots
  private checkLineCollision(
    b: PinballBall,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bounceMult: number = 1.0
  ): boolean {
    const lx = x2 - x1;
    const ly = y2 - y1;
    const lenSq = lx * lx + ly * ly;
    if (lenSq === 0) return false;

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
    const w = this.width;
    const h = this.height;

    // 1. Pinball Table Wood/Parchment Background
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ece3cb';
    ctx.fillRect(2, 2, w - 4, h - 4);

    // Decorative Playfield Center Sigil / Artwork
    ctx.strokeStyle = '#d4c5a3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(playW * 0.5, h * 0.32, 140, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Shooter Lane Track & Bottom Plunger Base
    ctx.fillStyle = '#d8cbab';
    ctx.fillRect(playW, 0, this.plungerWidth, h);

    // Shooter Lane Divider Metal Wall
    ctx.strokeStyle = '#2b2316';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(playW, 140);
    ctx.lineTo(playW, h * 0.84);
    ctx.stroke();

    // One-Way Wire Gate indicator at top of shooter lane
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ LAUNCH', playW + this.plungerWidth * 0.5, 134);

    // 3. THE PLUNGER: SPRING COIL & RED SQUARE LAUNCHER TIP
    const springRestY = h * 0.88;
    const compress = this.plungerTension * 48;
    const plateY = springRestY + compress;

    // Steel Plunger Shaft
    ctx.fillStyle = '#64748b';
    ctx.fillRect(playW + this.plungerWidth * 0.5 - 4, plateY + 16, 8, h - plateY);

    // Coiled Spring Graphics
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const springLen = h * 0.96 - (plateY + 18);
    const coils = 6;
    for (let c = 0; c <= coils; c++) {
      const cy = plateY + 18 + (c / coils) * springLen;
      const off = c % 2 === 0 ? -10 : 10;
      if (c === 0) ctx.moveTo(playW + this.plungerWidth * 0.5, cy);
      else ctx.lineTo(playW + this.plungerWidth * 0.5 + off, cy);
    }
    ctx.stroke();

    // SOLID RED SQUARE PLUNGER TIP (Ball rests directly on top of this!)
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(playW + 6, plateY, this.plungerWidth - 12, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Plunger rubber highlight
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(playW + 10, plateY + 3, this.plungerWidth - 20, 3);

    // Solid Plunger Bottom Base Housing (prevents anything falling out)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(playW, h * 0.96, this.plungerWidth, h * 0.04);

    // 4. Render Physical Walls & Guides
    ctx.strokeStyle = '#3e3422';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const wall of this.walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    }

    // 5. Render S-P-E-L-L Drop Targets
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

    // 6. Slingshots
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

      // Slingshot rubber bumper kicker line
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }

    // 7. Pop Bumpers (Triangle Cluster)
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
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
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

    // 8. Dual Flippers
    this.renderFlipper(ctx, this.leftFlipper);
    this.renderFlipper(ctx, this.rightFlipper);

    // 9. Bottom Drain Apron / Trough Graphics
    ctx.fillStyle = '#262626';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3;

    // Left Apron Triangle
    ctx.beginPath();
    ctx.moveTo(0, h * 0.83);
    ctx.lineTo(this.leftFlipper.pivotX - 10, h * 0.88 + 14);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Apron Triangle
    ctx.beginPath();
    ctx.moveTo(playW, h * 0.83);
    ctx.lineTo(this.rightFlipper.pivotX + 10, h * 0.88 + 14);
    ctx.lineTo(playW, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 10. Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 11. Balls
    for (const b of this.balls) {
      this.renderBall(ctx, b);
    }

    // 12. Floating Combo Text
    for (const t of this.floatTexts) {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.alpha;
      ctx.font = 'black 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1.0;
    }

    // 13. Top Score & Combo Banner
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(0, -6 + 5, f.length, 14, 7);
    ctx.fill();

    // Flipper Body (Classic Red Bat)
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(0, -7, f.length, 14, 7);
    ctx.fill();
    ctx.stroke();

    // Rubber Grip Stripe
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(f.length * 0.3, -5, f.length * 0.4, 2);

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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(-b.radius * 0.3, -b.radius * 0.3, b.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
