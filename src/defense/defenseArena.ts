import { sound } from '../audio';
import { PinballBallType } from '../pinball/pinballTable';

export type EnemyType = 'pig' | 'scout' | 'tank';

export interface DefenseEnemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  targetGate: 'north' | 'south' | 'east' | 'west';
  attackTimer: number;
  stunTimer: number;
  wingPhase: number;
}

export interface GateWall {
  sector: 'north' | 'south' | 'east' | 'west';
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shakeTimer: number;
}

export interface Turret {
  type: 'tesla' | 'flames' | 'mortar';
  level: number;
  x: number;
  y: number;
  fireTimer: number;
  angle: number;
}

export interface FloatingDamage {
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface DefenseFX {
  type: 'lightning' | 'flame_cone' | 'mortar_blast' | 'nuke' | 'hero_bolt';
  x: number;
  y: number;
  timer: number;
  maxTime: number;
  radius?: number;
  targets?: { x: number; y: number }[];
  angle?: number;
}

export class DefenseArena {
  public width: number = 0;
  public height: number = 0;

  // Fortress Sanctuary Core
  public coreHp: number = 100;
  public coreMaxHp: number = 100;
  public coreX: number = 0;
  public coreY: number = 0;
  public heroShootTimer: number = 0;

  // Perimeter Gates
  public gates: GateWall[] = [];

  // Spires
  public teslaSpire: Turret = { type: 'tesla', level: 1, x: 0, y: 0, fireTimer: 0, angle: Math.PI };
  public flamethrower: Turret = { type: 'flames', level: 1, x: 0, y: 0, fireTimer: 0, angle: 0 };
  public skyMortar: Turret = { type: 'mortar', level: 1, x: 0, y: 0, fireTimer: 0, angle: -Math.PI * 0.5 };

  // Entities & Waves
  public enemies: DefenseEnemy[] = [];
  public effects: DefenseFX[] = [];
  public damages: FloatingDamage[] = [];
  public gold: number = 120; // Scrap / Gold currency
  private nextEnemyId: number = 1;

  // Screen shake
  public shake: number = 0;

  constructor() {}

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.coreX = width * 0.5;
    this.coreY = height * 0.5;

    this.initFortress();
  }

  private initFortress() {
    const cx = this.coreX;
    const cy = this.coreY;
    const fortSize = 220;

    // 4 Perimeter Gates
    this.gates = [
      { sector: 'north', hp: 150, maxHp: 150, x: cx, y: cy - fortSize * 0.5, width: 90, height: 18, shakeTimer: 0 },
      { sector: 'south', hp: 150, maxHp: 150, x: cx, y: cy + fortSize * 0.5, width: 90, height: 18, shakeTimer: 0 },
      { sector: 'west', hp: 150, maxHp: 150, x: cx - fortSize * 0.5, y: cy, width: 18, height: 90, shakeTimer: 0 },
      { sector: 'east', hp: 150, maxHp: 150, x: cx + fortSize * 0.5, y: cy, width: 18, height: 90, shakeTimer: 0 }
    ];

    // Turret socket positions on the perimeter
    this.teslaSpire.x = cx - fortSize * 0.5;
    this.teslaSpire.y = cy - 55;

    this.flamethrower.x = cx + fortSize * 0.5;
    this.flamethrower.y = cy - 55;

    this.skyMortar.x = cx;
    this.skyMortar.y = cy - fortSize * 0.5 - 18;
  }

  public spawnWaveEnemies(count: number, waveNumber: number) {
    const sectors: ('north' | 'south' | 'east' | 'west')[] = ['north', 'south', 'east', 'west'];

    for (let i = 0; i < count; i++) {
      const sector = sectors[Math.floor(Math.random() * sectors.length)];
      let ex = 0;
      let ey = 0;

      if (sector === 'north') {
        ex = this.width * (0.2 + Math.random() * 0.6);
        ey = -20 - Math.random() * 80;
      } else if (sector === 'south') {
        ex = this.width * (0.2 + Math.random() * 0.6);
        ey = this.height + 20 + Math.random() * 80;
      } else if (sector === 'west') {
        ex = -20 - Math.random() * 80;
        ey = this.height * (0.2 + Math.random() * 0.6);
      } else {
        ex = this.width + 20 + Math.random() * 80;
        ey = this.height * (0.2 + Math.random() * 0.6);
      }

      // Enemy type based on wave
      let type: EnemyType = 'pig';
      const rand = Math.random();
      if (waveNumber >= 2 && rand < 0.28) {
        type = 'tank'; // Sturdy Armored Boar
      } else if (rand < 0.55) {
        type = 'scout'; // Fast Crimson Bat-Pig
      }

      let hp = 35 + waveNumber * 8;
      let speed = 65;
      let radius = 17;

      if (type === 'tank') {
        hp = 170 + waveNumber * 25;
        speed = 42;
        radius = 26;
      } else if (type === 'scout') {
        hp = 55 + waveNumber * 10;
        speed = 100;
        radius = 15;
      }

      this.enemies.push({
        id: this.nextEnemyId++,
        type,
        x: ex,
        y: ey,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius,
        speed,
        targetGate: sector,
        attackTimer: 0,
        stunTimer: 0,
        wingPhase: Math.random() * Math.PI * 2
      });
    }
  }

  // Triggered directly by the Pinball Bumper Hits
  public triggerPinballWeapon(
    type: 'tesla' | 'flames' | 'mortar' | 'nuke',
    ballType: PinballBallType,
    comboMultiplier: number
  ) {
    if (type === 'tesla') {
      this.fireTeslaSpire(comboMultiplier, ballType);
    } else if (type === 'flames') {
      this.fireFlamethrower(comboMultiplier, ballType);
    } else if (type === 'mortar') {
      this.fireSkyMortar(comboMultiplier, ballType);
    } else if (type === 'nuke') {
      this.fireScreenNuke();
    }
  }

  private fireTeslaSpire(combo: number, ballType: PinballBallType) {
    sound.playTeslaZap();
    this.teslaSpire.fireTimer = 0.2;

    const maxTargets = ballType === 'lightning' ? 8 : 4;
    const typeBonus = ballType === 'lightning' ? 1.4 : (ballType === 'fire' ? 1.2 : 1.0);
    const stunDuration = ballType === 'golem' ? 1.2 : 0.45;

    // Find closest enemies on West / North quadrants
    const candidates = this.enemies
      .filter(e => e.x < this.coreX + 120)
      .sort((a, b) => Math.hypot(a.x - this.teslaSpire.x, a.y - this.teslaSpire.y) - Math.hypot(b.x - this.teslaSpire.x, b.y - this.teslaSpire.y));

    const targets = candidates.slice(0, maxTargets);
    if (targets.length === 0) return;

    const zapTargets: { x: number; y: number }[] = [];
    const baseDamage = (40 + this.teslaSpire.level * 15) * combo * typeBonus;

    targets.forEach(e => {
      zapTargets.push({ x: e.x, y: e.y });
      e.hp -= baseDamage;
      e.stunTimer = stunDuration;
      const dmgColor = ballType === 'lightning' ? '#7dd3fc' : (ballType === 'fire' ? '#f97316' : '#38bdf8');
      this.addDamageText(`-${Math.floor(baseDamage)}${ballType === 'lightning' ? ' ⚡CRIT' : ''}`, e.x, e.y, dmgColor);
    });

    this.effects.push({
      type: 'lightning',
      x: this.teslaSpire.x,
      y: this.teslaSpire.y,
      timer: 0,
      maxTime: 0.25,
      targets: zapTargets
    });

    this.cleanDeadEnemies();
  }

  private fireFlamethrower(combo: number, ballType: PinballBallType) {
    sound.playFlamethrower();
    this.flamethrower.fireTimer = 0.25;

    const range = ballType === 'fire' ? 320 : 240;
    const typeBonus = ballType === 'fire' ? 1.5 : (ballType === 'lightning' ? 1.25 : 1.0);
    const baseDamage = (35 + this.flamethrower.level * 12) * combo * typeBonus;

    for (const e of this.enemies) {
      if (e.x > this.flamethrower.x - 20) {
        const dx = e.x - this.flamethrower.x;
        const dy = e.y - this.flamethrower.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= range && Math.abs(dy / (dx || 1)) < 0.85) {
          e.hp -= baseDamage;
          e.vx += ballType === 'golem' ? 240 : 120;
          const dmgColor = ballType === 'fire' ? '#ea580c' : '#fb923c';
          this.addDamageText(`-${Math.floor(baseDamage)}${ballType === 'fire' ? ' 🔥IGNITE' : ''}`, e.x, e.y, dmgColor);
        }
      }
    }

    this.effects.push({
      type: 'flame_cone',
      x: this.flamethrower.x,
      y: this.flamethrower.y,
      timer: 0,
      maxTime: 0.3,
      radius: range
    });

    this.cleanDeadEnemies();
  }

  private fireSkyMortar(combo: number, ballType: PinballBallType) {
    sound.playMortar();
    this.shake = ballType === 'golem' ? 20 : 12;
    this.skyMortar.fireTimer = 0.3;

    // Target largest enemy cluster
    let bestX = this.coreX;
    let bestY = this.coreY - 140;
    let maxCluster = 0;

    for (const e of this.enemies) {
      const cluster = this.enemies.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < 90).length;
      if (cluster > maxCluster) {
        maxCluster = cluster;
        bestX = e.x;
        bestY = e.y;
      }
    }

    const blastRadius = ballType === 'golem' ? 175 : (ballType === 'fire' ? 150 : 125);
    const typeBonus = ballType === 'golem' ? 1.4 : (ballType === 'fire' ? 1.3 : 1.0);
    const baseDamage = (70 + this.skyMortar.level * 25) * combo * typeBonus;

    for (const e of this.enemies) {
      const dist = Math.hypot(e.x - bestX, e.y - bestY);
      if (dist <= blastRadius) {
        e.hp -= baseDamage;
        const pushX = (e.x - bestX) || 1;
        const pushY = (e.y - bestY) || 1;
        const len = Math.hypot(pushX, pushY);
        const impulse = ballType === 'golem' ? 300 : 160;
        e.vx += (pushX / len) * impulse;
        e.vy += (pushY / len) * impulse;
        if (ballType === 'golem') e.stunTimer = 1.0;
        this.addDamageText(`-${Math.floor(baseDamage)}`, e.x, e.y, '#ef4444');
      }
    }

    this.effects.push({
      type: 'mortar_blast',
      x: bestX,
      y: bestY,
      timer: 0,
      maxTime: 0.35,
      radius: blastRadius
    });

    this.cleanDeadEnemies();
  }

  private fireScreenNuke() {
    this.shake = 22;
    sound.playNuke();

    for (const e of this.enemies) {
      e.hp -= 250;
      this.addDamageText('-250 NUKE!', e.x, e.y, '#f43f5e');
    }

    this.effects.push({
      type: 'nuke',
      x: this.coreX,
      y: this.coreY,
      timer: 0,
      maxTime: 0.55,
      radius: Math.max(this.width, this.height)
    });

    this.cleanDeadEnemies();
  }

  private cleanDeadEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        // Award gold/scrap
        const goldGain = e.type === 'tank' ? 25 : (e.type === 'scout' ? 12 : 8);
        this.gold += goldGain;
        sound.playGoldPickup();
        this.enemies.splice(i, 1);
      }
    }
  }

  public update(dt: number) {
    // Screen shake decay
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 25);
    }

    // Update Turrets cooldowns
    if (this.teslaSpire.fireTimer > 0) this.teslaSpire.fireTimer -= dt;
    if (this.flamethrower.fireTimer > 0) this.flamethrower.fireTimer -= dt;
    if (this.skyMortar.fireTimer > 0) this.skyMortar.fireTimer -= dt;

    // Update Gates shake
    for (const g of this.gates) {
      if (g.shakeTimer > 0) g.shakeTimer -= dt;
    }

    // Hero Core Auto-Shooter
    this.heroShootTimer += dt;
    if (this.heroShootTimer >= 0.65 && this.enemies.length > 0) {
      this.heroShootTimer = 0;
      this.heroShootClosest();
    }

    // Update Enemies
    for (const e of this.enemies) {
      e.wingPhase += dt * (e.type === 'scout' ? 20 : 12);
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.vx *= Math.pow(0.8, dt * 60);
        e.vy *= Math.pow(0.8, dt * 60);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        continue;
      }

      // Pathing: move towards assigned gate, or towards core if gate breached!
      const gate = this.gates.find(g => g.sector === e.targetGate)!;
      let targetX = gate ? gate.x : this.coreX;
      let targetY = gate ? gate.y : this.coreY;

      if (gate && gate.hp <= 0) {
        targetX = this.coreX;
        targetY = this.coreY;
      }

      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        const vx = (dx / dist) * e.speed;
        const vy = (dy / dist) * e.speed;
        e.vx += (vx - e.vx) * Math.min(1, dt * 5);
        e.vy += (vy - e.vy) * Math.min(1, dt * 5);
      } else {
        // Attack Gate or Core
        e.attackTimer += dt;
        if (e.attackTimer >= 0.8) {
          e.attackTimer = 0;
          const dmg = e.type === 'tank' ? 24 : 10;
          if (gate && gate.hp > 0) {
            gate.hp = Math.max(0, gate.hp - dmg);
            gate.shakeTimer = 0.2;
            sound.playGateHit();
            this.addDamageText(`-${dmg}`, gate.x, gate.y, '#f87171');
          } else {
            this.coreHp = Math.max(0, this.coreHp - dmg);
            this.shake = 10;
            sound.playGateHit();
            this.addDamageText(`-${dmg}`, this.coreX, this.coreY, '#ef4444');
          }
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    // Update FX
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.timer += dt;
      if (fx.timer >= fx.maxTime) {
        this.effects.splice(i, 1);
      }
    }

    // Update Damage Text
    for (let i = this.damages.length - 1; i >= 0; i--) {
      const d = this.damages[i];
      d.life += dt;
      d.y += d.vy * dt;
      d.alpha = Math.max(0, 1 - d.life / d.maxLife);
      if (d.life >= d.maxLife) this.damages.splice(i, 1);
    }
  }

  private heroShootClosest() {
    let closestDist = 99999;
    let closestEnemy: DefenseEnemy | null = null;

    for (const e of this.enemies) {
      const dist = Math.hypot(e.x - this.coreX, e.y - this.coreY);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = e;
      }
    }

    if (closestEnemy) {
      closestEnemy.hp -= 30;
      this.addDamageText('-30', closestEnemy.x, closestEnemy.y, '#facc15');
      this.effects.push({
        type: 'hero_bolt',
        x: this.coreX,
        y: this.coreY,
        timer: 0,
        maxTime: 0.15,
        targets: [{ x: closestEnemy.x, y: closestEnemy.y }]
      });
      this.cleanDeadEnemies();
    }
  }

  public addDamageText(text: string, x: number, y: number, color: string) {
    this.damages.push({
      text,
      x: x + (Math.random() * 16 - 8),
      y: y + (Math.random() * 16 - 8),
      vy: -40,
      color,
      alpha: 1.0,
      life: 0,
      maxLife: 0.65
    });
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Camera shake
    if (this.shake > 0) {
      const sx = (Math.random() - 0.5) * this.shake * 2;
      const sy = (Math.random() - 0.5) * this.shake * 2;
      ctx.translate(sx, sy);
    }

    // 1. Battlefield Grass Background (Paper green canvas)
    ctx.fillStyle = '#22602b';
    ctx.fillRect(0, 0, this.width, this.height);

    // Decorative approach lanes
    ctx.strokeStyle = '#1d4a23';
    ctx.lineWidth = 44;
    // North-South lane
    ctx.beginPath();
    ctx.moveTo(this.coreX, 0);
    ctx.lineTo(this.coreX, this.height);
    ctx.stroke();
    // East-West lane
    ctx.beginPath();
    ctx.moveTo(0, this.coreY);
    ctx.lineTo(this.width, this.coreY);
    ctx.stroke();

    // 2. Perimeter Walls & Gates
    this.renderFortressWalls(ctx);

    // 3. Defense Spires
    this.renderTurrets(ctx);

    // 4. Enemies
    for (const e of this.enemies) {
      this.renderEnemy(ctx, e);
    }

    // 5. Central Wizard Sanctuary Core
    this.renderCore(ctx);

    // 6. Combat FX (Lightning, Fire cone, Mortar crater)
    this.renderCombatFX(ctx);

    // 7. Floating Damage Numbers
    for (const d of this.damages) {
      ctx.fillStyle = d.color;
      ctx.globalAlpha = d.alpha;
      ctx.font = 'black 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.text, d.x, d.y);
      ctx.globalAlpha = 1.0;
    }

    // 8. Top Battlefield HUD (Core HP & Scrap Gold)
    ctx.fillStyle = 'rgba(15, 20, 15, 0.85)';
    ctx.fillRect(10, 10, 240, 48);
    ctx.strokeStyle = '#386638';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 240, 48);

    // Core HP Bar
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`SANCTUARY: ${Math.floor(this.coreHp)} / ${this.coreMaxHp}`, 20, 26);

    const hpW = 220;
    const hpRatio = Math.max(0, this.coreHp / this.coreMaxHp);
    ctx.fillStyle = '#111';
    ctx.fillRect(20, 32, hpW, 8);
    ctx.fillStyle = hpRatio > 0.3 ? '#22c55e' : '#ef4444';
    ctx.fillRect(20, 32, hpW * hpRatio, 8);

    // Gold / Scrap
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'black 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`🪙 SCRAP: ${this.gold}`, this.width - 20, 30);

    ctx.restore();
  }

  private renderFortressWalls(ctx: CanvasRenderingContext2D) {
    const cx = this.coreX;
    const cy = this.coreY;
    const fortSize = 220;
    const hs = fortSize * 0.5;

    // Wooden wall perimeter
    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 14;
    ctx.strokeRect(cx - hs, cy - hs, fortSize, fortSize);

    // Gates
    for (const g of this.gates) {
      let shakeOff = 0;
      if (g.shakeTimer > 0) shakeOff = (Math.random() - 0.5) * 4;

      if (g.hp > 0) {
        ctx.fillStyle = '#854d0e';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.fillRect(g.x - g.width * 0.5 + shakeOff, g.y - g.height * 0.5, g.width, g.height);
        ctx.strokeRect(g.x - g.width * 0.5 + shakeOff, g.y - g.height * 0.5, g.width, g.height);

        // Gate HP mini bar
        const r = g.hp / g.maxHp;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(g.x - g.width * 0.5 + shakeOff, g.y - g.height * 0.5 - 4, g.width * r, 3);
      } else {
        // Broken gate rubble
        ctx.fillStyle = '#451a03';
        ctx.fillRect(g.x - g.width * 0.5, g.y - g.height * 0.5, g.width, g.height);
      }
    }
  }

  private renderTurrets(ctx: CanvasRenderingContext2D) {
    // Tesla Spire (West)
    ctx.save();
    ctx.translate(this.teslaSpire.x, this.teslaSpire.y);
    ctx.fillStyle = this.teslaSpire.fireTimer > 0 ? '#38bdf8' : '#0284c7';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', 0, 0);
    ctx.restore();

    // Flamethrower (East)
    ctx.save();
    ctx.translate(this.flamethrower.x, this.flamethrower.y);
    ctx.fillStyle = this.flamethrower.fireTimer > 0 ? '#fb923c' : '#ea580c';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥', 0, 0);
    ctx.restore();

    // Sky-Mortar (North)
    ctx.save();
    ctx.translate(this.skyMortar.x, this.skyMortar.y);
    ctx.fillStyle = this.skyMortar.fireTimer > 0 ? '#c084fc' : '#9333ea';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💥', 0, 0);
    ctx.restore();
  }

  private renderCore(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.coreX, this.coreY);

    // Sanctuary Floor
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-30, -30, 60, 60, 12);
    ctx.fill();
    ctx.stroke();

    // The Little Wizard Hero
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wizard Blue Hat
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(0, -18);
    ctx.lineTo(10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: DefenseEnemy) {
    ctx.save();
    ctx.translate(e.x, e.y);

    const isTank = e.type === 'tank';
    const isScout = e.type === 'scout';

    // Bat Wings
    const wingFlap = Math.sin(e.wingPhase) * (isTank ? 6 : 12);
    ctx.fillStyle = isScout ? '#b91c1c' : (isTank ? '#334155' : '#3e842e');
    ctx.strokeStyle = '#111';
    ctx.lineWidth = isTank ? 3 : 2;

    const span = isTank ? 26 : 18;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-span, -8 + wingFlap);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(span, -8 + wingFlap);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.fillStyle = isTank ? '#3f6233' : (isScout ? '#dc2626' : '#57b841');
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Snout
    ctx.fillStyle = isTank ? '#475569' : (isScout ? '#991b1b' : '#459932');
    ctx.beginPath();
    ctx.ellipse(0, 2, isTank ? 9 : 6, isTank ? 6 : 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mini HP Bar
    const hpR = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-e.radius, -e.radius - 7, e.radius * 2 * hpR, 3);

    ctx.restore();
  }

  private renderCombatFX(ctx: CanvasRenderingContext2D) {
    for (const fx of this.effects) {
      const progress = fx.timer / fx.maxTime;
      const alpha = Math.max(0, 1 - progress);

      if (fx.type === 'lightning' && fx.targets) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (const t of fx.targets) {
          ctx.moveTo(fx.x, fx.y);
          ctx.lineTo(t.x, t.y);
        }
        ctx.stroke();
      } else if (fx.type === 'flame_cone') {
        const r = fx.radius || 200;
        const grad = ctx.createRadialGradient(fx.x, fx.y, 10, fx.x, fx.y, r);
        grad.addColorStop(0, `rgba(254, 240, 138, ${alpha})`);
        grad.addColorStop(0.5, `rgba(249, 115, 22, ${alpha * 0.8})`);
        grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r * progress, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.lineTo(fx.x, fx.y);
        ctx.fill();
      } else if (fx.type === 'mortar_blast') {
        const r = (fx.radius || 100) * progress;
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (fx.type === 'hero_bolt' && fx.targets && fx.targets[0]) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.targets[0].x, fx.targets[0].y);
        ctx.stroke();
      }
    }
  }
}
