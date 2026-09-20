import { sound } from './audio';
import { BallType } from './chamber';

export type EnemyType = 'pig' | 'tank' | 'scout';

export interface GrassTuft {
  x: number;
  y: number;
  blades: { dx: number; dy: number; height: number; angle: number }[];
}

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface AttackFX {
  type: 'slash' | 'nova' | 'multistrike' | 'lightning' | 'meteor';
  x: number;
  y: number;
  timer: number;
  maxTime: number;
  radius?: number;
  maxRadius?: number;
  slashes?: { x1: number; y1: number; x2: number; y2: number }[];
  lightningTargets?: { x1: number; y1: number; x2: number; y2: number }[];
}

export interface FirePatch {
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTime: number;
  tickTimer: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  wingPhase: number;
  hurtTimer: number;
  stunTimer: number;
  facing: number; // -1 left, 1 right
}

export interface Chest {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shakeTimer: number;
}

export interface Gem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bobPhase: number;
  collected: boolean;
}

export interface SpellCard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bobPhase: number;
  rotation: number;
  collected: boolean;
}

export interface ShardParticle {
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

export class SurvivorArena {
  public width: number = 0;
  public height: number = 0;
  public gameTime: number = 0;

  // Player state
  public player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 260,
    radius: 20,
    hp: 100,
    maxHp: 100,
    facing: 1,
    walkPhase: 0,
    invincibleTimer: 0,
    magnetRadius: 160
  };

  // Upgrades & Perks
  public stats = {
    slashDamage: 45,
    novaRadius: 220,
    novaDamage: 65,
    slashTargets: 1,
    gemsCollected: 0,
    level: 1,
    xp: 0,
    xpNeeded: 25 // Higher initial XP requirement so cards don't pop instantly
  };

  // Camera
  public camera = { x: 0, y: 0, shake: 0 };

  // World objects
  public grassTufts: GrassTuft[] = [];
  public dustParticles: DustParticle[] = [];
  public shardParticles: ShardParticle[] = [];
  public attackEffects: AttackFX[] = [];
  public firePatches: FirePatch[] = [];
  public enemies: Enemy[] = [];
  public chests: Chest[] = [];
  public gems: Gem[] = [];
  public cards: SpellCard[] = [];

  // Auto-targeting reticle
  public target: { x: number; y: number; id: number; type: 'enemy' | 'chest' } | null = null;
  public reticle = { x: 0, y: 0, size: 42, active: false };

  // Wave Spawner
  private enemySpawnTimer: number = 0;
  private nextEnemyId: number = 1;
  private nextChestId: number = 1;

  public onCardPickup?: () => void;
  public onGameOver?: () => void;

  constructor() {
    this.initGrass();
    this.initChests();
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  private initGrass() {
    // Generate organic grass tufts across the arena
    this.grassTufts = [];
    for (let i = 0; i < 70; i++) {
      const gx = (Math.random() - 0.5) * 3000;
      const gy = (Math.random() - 0.5) * 3000;
      const bladeCount = 5 + Math.floor(Math.random() * 4);
      const blades = [];
      for (let b = 0; b < bladeCount; b++) {
        blades.push({
          dx: (b - bladeCount / 2) * 6 + (Math.random() * 4 - 2),
          dy: (Math.random() * 6 - 3),
          height: 14 + Math.random() * 12,
          angle: (Math.random() * 0.4 - 0.2)
        });
      }
      this.grassTufts.push({ x: gx, y: gy, blades });
    }
  }

  private initChests() {
    this.chests = [];
    const chestPositions = [
      { x: -180, y: -160 },
      { x: 190, y: 150 },
      { x: 260, y: -220 },
      { x: -280, y: 240 },
      { x: 0, y: 380 },
      { x: -450, y: -80 }
    ];
    for (const pos of chestPositions) {
      this.chests.push({
        id: this.nextChestId++,
        x: pos.x,
        y: pos.y,
        hp: 3,
        maxHp: 3,
        shakeTimer: 0
      });
    }
  }

  public update(dt: number, input: { up: boolean; down: boolean; left: boolean; right: boolean }) {
    this.gameTime += dt;

    // 1. Player Movement & Input
    let moveX = 0;
    let moveY = 0;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    if (input.up) moveY -= 1;
    if (input.down) moveY += 1;

    if (moveX !== 0 && moveY !== 0) {
      const len = Math.SQRT2;
      moveX /= len;
      moveY /= len;
    }

    const targetVx = moveX * this.player.speed;
    const targetVy = moveY * this.player.speed;

    // Smooth inertia
    this.player.vx += (targetVx - this.player.vx) * Math.min(1, dt * 14);
    this.player.vy += (targetVy - this.player.vy) * Math.min(1, dt * 14);

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    if (Math.abs(this.player.vx) > 10) {
      this.player.facing = this.player.vx > 0 ? 1 : -1;
    }

    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (speed > 25) {
      this.player.walkPhase += dt * 12;
      // Spawn dust puff at feet
      if (Math.random() < dt * 15) {
        this.dustParticles.push({
          x: this.player.x + (Math.random() * 12 - 6),
          y: this.player.y + 16 + (Math.random() * 4 - 2),
          vx: -this.player.vx * 0.15 + (Math.random() * 16 - 8),
          vy: -this.player.vy * 0.15 - (Math.random() * 10),
          radius: 5 + Math.random() * 4,
          alpha: 0.6,
          life: 0,
          maxLife: 0.35
        });
      }
    }

    if (this.player.invincibleTimer > 0) {
      this.player.invincibleTimer -= dt;
    }

    // 2. Camera follow with smoothing & screen shake
    const targetCamX = this.player.x - this.width * 0.5;
    const targetCamY = this.player.y - this.height * 0.5;
    this.camera.x += (targetCamX - this.camera.x) * Math.min(1, dt * 8);
    this.camera.y += (targetCamY - this.camera.y) * Math.min(1, dt * 8);

    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - dt * 25);
    }

    // 3. Enemy Spawning - Scaled over time
    this.enemySpawnTimer += dt;
    const spawnInterval = Math.max(0.35, 1.8 - (this.gameTime / 60) * 0.7 - this.stats.level * 0.05);
    const maxEnemies = Math.min(110, 30 + Math.floor(this.gameTime / 12) * 8);

    if (this.enemySpawnTimer >= spawnInterval && this.enemies.length < maxEnemies) {
      this.enemySpawnTimer = 0;
      this.spawnEnemyWave();
    }

    // 4. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.wingPhase += dt * (e.type === 'scout' ? 22 : 14);
      if (e.hurtTimer > 0) e.hurtTimer -= dt;

      // Check stun
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.vx *= Math.pow(0.8, dt * 60);
        e.vy *= Math.pow(0.8, dt * 60);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        continue; // Skip steering while stunned
      }

      // Steering toward player
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 5) {
        let baseSpeed = 75;
        if (e.type === 'scout') baseSpeed = 115;
        if (e.type === 'tank') baseSpeed = 52;

        const spd = baseSpeed + Math.min(45, (this.gameTime / 30) * 8);
        const desiredVx = (dx / dist) * spd;
        const desiredVy = (dy / dist) * spd;

        const steerRate = e.type === 'tank' ? 2.5 : 4.5;
        e.vx += (desiredVx - e.vx) * Math.min(1, dt * steerRate);
        e.vy += (desiredVy - e.vy) * Math.min(1, dt * steerRate);
      }

      // Separation from other enemies
      for (let j = 0; j < this.enemies.length; j++) {
        if (i === j) continue;
        const o = this.enemies[j];
        const sepDx = e.x - o.x;
        const sepDy = e.y - o.y;
        const sepDist = Math.hypot(sepDx, sepDy);
        const minSep = e.radius + o.radius + 6;
        if (sepDist < minSep && sepDist > 0.01) {
          const push = (minSep - sepDist) * 1.5;
          e.vx += (sepDx / sepDist) * push * dt * 20;
          e.vy += (sepDy / sepDist) * push * dt * 20;
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.facing = e.vx > 0 ? 1 : -1;

      // Collision with Player
      if (dist < e.radius + this.player.radius && this.player.invincibleTimer <= 0) {
        const damage = e.type === 'tank' ? 20 : (e.type === 'scout' ? 10 : 12);
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.player.invincibleTimer = 0.6;
        this.camera.shake = 10;
        sound.playPlayerHurt();

        // Push enemy back
        e.vx = -dx * 2;
        e.vy = -dy * 2;

        if (this.player.hp <= 0 && this.onGameOver) {
          this.onGameOver();
        }
      }
    }

    // 5. Update Fire Patches (from Fireball)
    for (let i = this.firePatches.length - 1; i >= 0; i--) {
      const fp = this.firePatches[i];
      fp.timer += dt;
      fp.tickTimer += dt;

      if (fp.tickTimer >= 0.15) {
        fp.tickTimer = 0;
        // Burn enemies in radius
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - fp.x, e.y - fp.y);
          if (d <= fp.radius) {
            this.damageEnemy(e, 14, fp.x, fp.y);
          }
        }
      }

      if (fp.timer >= fp.maxTime) {
        this.firePatches.splice(i, 1);
      }
    }

    // 6. Update Chests
    for (const c of this.chests) {
      if (c.shakeTimer > 0) c.shakeTimer -= dt;
    }

    // 7. Update Reticle & Auto-Targeting (STRICTLY ON-SCREEN ONLY)
    this.updateTargeting();

    // 8. Update Attack Effects
    for (let i = this.attackEffects.length - 1; i >= 0; i--) {
      const fx = this.attackEffects[i];
      fx.timer += dt;
      if (fx.type === 'nova' && fx.radius !== undefined && fx.maxRadius !== undefined) {
        const progress = fx.timer / fx.maxTime;
        fx.radius = fx.maxRadius * Math.sin(progress * Math.PI * 0.5);
      }
      if (fx.timer >= fx.maxTime) {
        this.attackEffects.splice(i, 1);
      }
    }

    // 9. Update Particles
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 0.6 * (1 - p.life / p.maxLife));
      p.radius += dt * 4;
      if (p.life >= p.maxLife) this.dustParticles.splice(i, 1);
    }

    for (let i = this.shardParticles.length - 1; i >= 0; i--) {
      const p = this.shardParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.9, dt * 60);
      p.vy *= Math.pow(0.9, dt * 60);
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) this.shardParticles.splice(i, 1);
    }

    // 10. Update Gems & Magnetic Attraction
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.bobPhase += dt * 5;

      const dx = this.player.x - g.x;
      const dy = this.player.y - g.y;
      const dist = Math.hypot(dx, dy);

      if (dist < this.player.magnetRadius) {
        const pull = 500 * (1 - dist / this.player.magnetRadius) + 250;
        g.vx += (dx / dist) * pull * dt;
        g.vy += (dy / dist) * pull * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
      }

      if (dist < this.player.radius + 14) {
        sound.playGemPickup();
        this.stats.gemsCollected++;
        this.stats.xp++;
        if (this.stats.xp >= this.stats.xpNeeded) {
          this.stats.xp = 0;
          this.stats.level++;
          // Progressive scaling so level-ups are rewarding and not instant
          this.stats.xpNeeded = Math.floor(this.stats.xpNeeded * 1.4);
          if (this.onCardPickup) this.onCardPickup();
        }
        this.gems.splice(i, 1);
      }
    }

    // 11. Update Spell Cards
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      c.bobPhase += dt * 4;
      c.rotation = Math.sin(c.bobPhase) * 0.15;

      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy);

      if (dist < this.player.magnetRadius + 40) {
        const pull = 380;
        c.vx += (dx / dist) * pull * dt;
        c.vy += (dy / dist) * pull * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }

      if (dist < this.player.radius + 18) {
        sound.playCardPickup();
        this.cards.splice(i, 1);
        if (this.onCardPickup) this.onCardPickup();
      }
    }
  }

  // Spawns swarms of enemies scaled over time
  private spawnEnemyWave() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 580 + Math.random() * 120;
    // Enemy count increases as game time progresses
    const count = 2 + Math.min(8, Math.floor(this.gameTime / 20));

    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 80;
      const offsetY = (Math.random() - 0.5) * 80;

      // Determine enemy type based on survival time
      let type: EnemyType = 'pig';
      const rand = Math.random();
      if (this.gameTime > 18) {
        if (rand < 0.28) {
          type = 'tank'; // Sturdy Armored Boar
        } else if (rand < 0.55) {
          type = 'scout'; // Fast Crimson Bat-Pig
        }
      } else if (this.gameTime > 8) {
        if (rand < 0.2) {
          type = 'scout';
        }
      }

      let hp = 40 + this.stats.level * 8;
      let radius = 20;

      if (type === 'tank') {
        hp = 160 + this.stats.level * 25; // Much sturdier!
        radius = 28;
      } else if (type === 'scout') {
        hp = 55 + this.stats.level * 10;
        radius = 18;
      }

      this.enemies.push({
        id: this.nextEnemyId++,
        type,
        x: this.player.x + Math.cos(angle) * distance + offsetX,
        y: this.player.y + Math.sin(angle) * distance + offsetY,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        radius,
        wingPhase: Math.random() * Math.PI * 2,
        hurtTimer: 0,
        stunTimer: 0,
        facing: 1
      });
    }
  }

  // Bracket Reticle automatically acquires nearest enemy or chest (STRICTLY ON-SCREEN ONLY)
  private updateTargeting() {
    let closestDist = 99999;
    let bestTarget: { x: number; y: number; id: number; type: 'enemy' | 'chest' } | null = null;

    // Viewport boundaries with safety padding
    const minX = this.camera.x + 35;
    const maxX = this.camera.x + this.width - 35;
    const minY = this.camera.y + 35;
    const maxY = this.camera.y + this.height - 35;

    // Check enemies - strictly onscreen
    for (const e of this.enemies) {
      if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) {
        continue; // Offscreen enemies are ignored!
      }
      const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (dist < closestDist) {
        closestDist = dist;
        bestTarget = { x: e.x, y: e.y, id: e.id, type: 'enemy' };
      }
    }

    // Check chests - strictly onscreen
    for (const c of this.chests) {
      if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) {
        continue;
      }
      const dist = Math.hypot(c.x - this.player.x, c.y - this.player.y);
      if (dist < closestDist) {
        closestDist = dist;
        bestTarget = { x: c.x, y: c.y, id: c.id, type: 'chest' };
      }
    }

    this.target = bestTarget;

    if (bestTarget) {
      this.reticle.active = true;
      this.reticle.size = bestTarget.type === 'chest' ? 52 : (bestTarget.type === 'enemy' ? 44 : 40);
      this.reticle.x += (bestTarget.x - this.reticle.x) * 0.28;
      this.reticle.y += (bestTarget.y - this.reticle.y) * 0.28;
    } else {
      this.reticle.active = false;
      this.reticle.x = this.player.x;
      this.reticle.y = this.player.y;
    }
  }

  // Triggered by Flower Bumpers with Ball-Type Synergies
  public triggerAttack(type: 'nova' | 'slash' | 'multistrike', ballType: BallType = 'standard') {
    // 1. Ball-Specific Special Effects
    if (ballType === 'lightning') {
      this.triggerLightningAttack();
    } else if (ballType === 'fire') {
      this.triggerMeteorAttack();
    } else if (ballType === 'heavy') {
      this.triggerSeismicSlam();
    }

    // 2. Flower Bumper Attacks (Nova or Precision Slashes)
    if (type === 'nova') {
      // Nova Blast centered on locked target or player
      const targetX = this.target ? this.target.x : this.player.x;
      const targetY = this.target ? this.target.y : this.player.y;

      sound.playNova();
      this.camera.shake = 12;

      this.attackEffects.push({
        type: 'nova',
        x: targetX,
        y: targetY,
        timer: 0,
        maxTime: 0.35,
        radius: 10,
        maxRadius: this.stats.novaRadius
      });

      // Damage only enemies within radius that are on-screen
      const minX = this.camera.x - 20;
      const maxX = this.camera.x + this.width + 20;
      const minY = this.camera.y - 20;
      const maxY = this.camera.y + this.height + 20;

      for (const e of this.enemies) {
        if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) continue;
        const dist = Math.hypot(e.x - targetX, e.y - targetY);
        if (dist <= this.stats.novaRadius) {
          this.damageEnemy(e, this.stats.novaDamage, targetX, targetY);
        }
      }

      for (const c of this.chests) {
        if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) continue;
        const dist = Math.hypot(c.x - targetX, c.y - targetY);
        if (dist <= this.stats.novaRadius) {
          this.damageChest(c);
        }
      }
    } else {
      // Precision Slash or Multi-strike: ONLY if there is an on-screen target!
      if (!this.target) return;

      const targetX = this.target.x;
      const targetY = this.target.y;

      sound.playSlash();
      this.camera.shake = 5;

      const count = type === 'multistrike' ? 3 : 2;
      const slashes = [];
      for (let s = 0; s < count; s++) {
        const angle = (Math.PI / 4) * (s % 2 === 0 ? 1 : -1) + (Math.random() * 0.3 - 0.15);
        const len = 34;
        slashes.push({
          x1: -Math.cos(angle) * len,
          y1: -Math.sin(angle) * len,
          x2: Math.cos(angle) * len,
          y2: Math.sin(angle) * len
        });
      }

      this.attackEffects.push({
        type: 'slash',
        x: targetX,
        y: targetY,
        timer: 0,
        maxTime: 0.2,
        slashes
      });

      if (this.target.type === 'enemy') {
        const enemy = this.enemies.find(e => e.id === this.target?.id);
        if (enemy) {
          this.damageEnemy(enemy, this.stats.slashDamage, this.player.x, this.player.y);
        }
      } else if (this.target.type === 'chest') {
        const chest = this.chests.find(c => c.id === this.target?.id);
        if (chest) {
          this.damageChest(chest);
        }
      }
    }
  }

  // Lightning Ball: Chains bright electric arcs to up to 4 onscreen foes
  private triggerLightningAttack() {
    const minX = this.camera.x + 30;
    const maxX = this.camera.x + this.width - 30;
    const minY = this.camera.y + 30;
    const maxY = this.camera.y + this.height - 30;

    const onscreenEnemies = this.enemies.filter(
      e => e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY
    );

    if (onscreenEnemies.length === 0) return;

    sound.playLightning();
    const hits = onscreenEnemies.slice(0, 4);
    const lightningLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    let prevX = this.player.x;
    let prevY = this.player.y;

    for (const e of hits) {
      lightningLines.push({ x1: prevX, y1: prevY, x2: e.x, y2: e.y });
      this.damageEnemy(e, 38, prevX, prevY);
      e.stunTimer = 0.35;
      prevX = e.x;
      prevY = e.y;
    }

    this.attackEffects.push({
      type: 'lightning',
      x: this.player.x,
      y: this.player.y,
      timer: 0,
      maxTime: 0.22,
      lightningTargets: lightningLines
    });
  }

  // Fireball: Drops an explosive meteor and creates burning ground
  private triggerMeteorAttack() {
    const targetX = this.target ? this.target.x : (this.player.x + this.player.facing * 100);
    const targetY = this.target ? this.target.y : this.player.y;

    sound.playMeteor();
    this.camera.shake = 10;

    // Meteor impact blast
    this.attackEffects.push({
      type: 'meteor',
      x: targetX,
      y: targetY,
      timer: 0,
      maxTime: 0.3,
      radius: 12,
      maxRadius: 110
    });

    // Spawn burning ground patch
    this.firePatches.push({
      x: targetX,
      y: targetY,
      radius: 95,
      timer: 0,
      maxTime: 3.5,
      tickTimer: 0
    });

    // Direct impact damage
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - targetX, e.y - targetY);
      if (d <= 110) {
        this.damageEnemy(e, 55, targetX, targetY);
      }
    }
  }

  // Heavy Ball: Stuns all on-screen enemies with seismic shock
  private triggerSeismicSlam() {
    sound.playSeismicStun();
    this.camera.shake = 16;

    const minX = this.camera.x + 20;
    const maxX = this.camera.x + this.width - 20;
    const minY = this.camera.y + 20;
    const maxY = this.camera.y + this.height - 20;

    for (const e of this.enemies) {
      if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
        e.stunTimer = 1.3; // Stunned!
        this.damageEnemy(e, 28, this.player.x, this.player.y);
      }
    }
  }

  private damageEnemy(e: Enemy, damage: number, originX: number, originY: number) {
    e.hp -= damage;
    e.hurtTimer = 0.1;

    // Knockback (Tanks resist knockback)
    const kx = e.x - originX;
    const ky = e.y - originY;
    const dist = Math.hypot(kx, ky) || 1;
    const knockbackForce = e.type === 'tank' ? 65 : 180;

    e.vx += (kx / dist) * knockbackForce;
    e.vy += (ky / dist) * knockbackForce;

    // Enemy Death
    if (e.hp <= 0) {
      this.destroyEnemy(e);
    }
  }

  private destroyEnemy(e: Enemy) {
    const idx = this.enemies.indexOf(e);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);

      // Shard death burst
      const shardCount = e.type === 'tank' ? 18 : 10;
      for (let s = 0; s < shardCount; s++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 150;
        let color = '#4fa33b';
        if (e.type === 'tank') color = Math.random() > 0.4 ? '#334155' : '#e2e8f0';
        else if (e.type === 'scout') color = Math.random() > 0.4 ? '#dc2626' : '#fef08a';

        this.shardParticles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          size: e.type === 'tank' ? 6 + Math.random() * 5 : 4 + Math.random() * 4,
          color,
          alpha: 1.0,
          life: 0,
          maxLife: 0.35
        });
      }

      // Drop Diamond XP Gems
      let gemCount = 2;
      if (e.type === 'tank') gemCount = 5 + Math.floor(Math.random() * 3);
      else if (e.type === 'scout') gemCount = 3;

      for (let g = 0; g < gemCount; g++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 20 + Math.random() * 40;
        this.gems.push({
          id: Math.random(),
          x: e.x + Math.cos(a) * 12,
          y: e.y + Math.sin(a) * 12,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          bobPhase: Math.random() * Math.PI * 2,
          collected: false
        });
      }

      // Card drop chance: 2.5% for normal pig, 25% for sturdy tank!
      const cardChance = e.type === 'tank' ? 0.25 : 0.025;
      if (Math.random() < cardChance) {
        this.cards.push({
          id: Math.random(),
          x: e.x,
          y: e.y,
          vx: 0,
          vy: -20,
          bobPhase: 0,
          rotation: 0,
          collected: false
        });
      }
    }
  }

  private damageChest(chest: Chest) {
    chest.hp -= 1;
    chest.shakeTimer = 0.2;
    sound.playChestHit();

    // Wood splinters
    for (let s = 0; s < 6; s++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 80;
      this.shardParticles.push({
        x: chest.x,
        y: chest.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 4 + Math.random() * 3,
        color: '#8b4513',
        alpha: 1.0,
        life: 0,
        maxLife: 0.3
      });
    }

    if (chest.hp <= 0) {
      sound.playChestBreak();
      const idx = this.chests.indexOf(chest);
      if (idx !== -1) {
        this.chests.splice(idx, 1);

        // Huge shower of diamond gems
        for (let g = 0; g < 14; g++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 40 + Math.random() * 80;
          this.gems.push({
            id: Math.random(),
            x: chest.x,
            y: chest.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            bobPhase: Math.random() * Math.PI * 2,
            collected: false
          });
        }

        // Guaranteed glowing spell card drop!
        this.cards.push({
          id: Math.random(),
          x: chest.x,
          y: chest.y - 10,
          vx: 0,
          vy: -30,
          bobPhase: 0,
          rotation: 0,
          collected: false
        });
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Apply Camera translation and Shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.camera.shake > 0) {
      shakeX = (Math.random() - 0.5) * this.camera.shake * 2;
      shakeY = (Math.random() - 0.5) * this.camera.shake * 2;
    }

    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

    // Background Grass Field (Green canvas with paper texture)
    ctx.fillStyle = '#2d8b38';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    // 1. Render Grass Tufts
    ctx.fillStyle = '#1e6628';
    for (const tuft of this.grassTufts) {
      if (
        tuft.x < this.camera.x - 50 ||
        tuft.x > this.camera.x + this.width + 50 ||
        tuft.y < this.camera.y - 50 ||
        tuft.y > this.camera.y + this.height + 50
      ) {
        continue;
      }
      for (const blade of tuft.blades) {
        ctx.save();
        ctx.translate(tuft.x + blade.dx, tuft.y + blade.dy);
        ctx.rotate(blade.angle);
        ctx.beginPath();
        ctx.moveTo(-2.5, 0);
        ctx.lineTo(0, -blade.height);
        ctx.lineTo(2.5, 0);
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Render Burning Ground Patches (from Fireball)
    for (const fp of this.firePatches) {
      this.renderFirePatch(ctx, fp);
    }

    // 3. Render Chests
    for (const chest of this.chests) {
      this.renderChest(ctx, chest);
    }

    // 4. Render Gems
    for (const gem of this.gems) {
      this.renderGem(ctx, gem);
    }

    // 5. Render Spell Cards
    for (const card of this.cards) {
      this.renderSpellCard(ctx, card);
    }

    // 6. Render Dust Particles
    for (const p of this.dustParticles) {
      ctx.fillStyle = `rgba(240, 240, 240, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Render Shard Particles
    for (const p of this.shardParticles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      ctx.globalAlpha = 1.0;
    }

    // 8. Render Enemies (Bat-Pigs, Tanks, Scouts)
    for (const enemy of this.enemies) {
      this.renderEnemy(ctx, enemy);
    }

    // 9. Render Player (The Wizard)
    this.renderPlayer(ctx);

    // 10. Render Targeting Reticle [ ]
    if (this.reticle.active) {
      this.renderReticle(ctx, this.reticle.x, this.reticle.y, this.reticle.size);
    }

    // 11. Render Attack Effects (Nova, Slashes, Lightning, Meteor)
    for (const fx of this.attackEffects) {
      this.renderAttackFX(ctx, fx);
    }

    ctx.restore();

    // 12. Render Bottom-Left HUD (Coins & Health)
    this.renderHUD(ctx);
  }

  // Draw cute Wizard player matching video
  private renderPlayer(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.player.x, this.player.y);

    // Drop Shadow
    ctx.fillStyle = '#162b14';
    ctx.beginPath();
    ctx.ellipse(0, 16, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Invincibility flashing
    if (this.player.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Tilt hat/body slightly based on movement
    const lean = (this.player.vx / this.player.speed) * 0.15;
    ctx.rotate(lean);

    // Body: Round white bean
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cute black dot eyes
    const eyeOffset = this.player.facing * 4;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(-4 + eyeOffset, 3, 2.2, 0, Math.PI * 2);
    ctx.arc(4 + eyeOffset, 3, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Cute beak/mouth
    ctx.fillStyle = '#f8ca20';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(eyeOffset, 7, 5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Blue Wizard Hat
    ctx.save();
    ctx.translate(0, -5);

    // Hat Brim
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 6, -lean * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hat Cone
    ctx.beginPath();
    ctx.moveTo(-13, -1);
    ctx.quadraticCurveTo(-4, -18, 2, -26);
    ctx.quadraticCurveTo(8, -14, 13, -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Yellow Buckle / Band
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.rect(-6, -4, 12, 4);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  // Draw enemies (Standard Bat-Pig, Sturdy Armored Boar Tank, and Crimson Scout)
  private renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);

    const isTank = e.type === 'tank';
    const isScout = e.type === 'scout';

    // Drop Shadow
    ctx.fillStyle = '#162b14';
    ctx.beginPath();
    ctx.ellipse(0, isTank ? 22 : 16, isTank ? 28 : 19, isTank ? 12 : 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bat Wings
    const wingFlap = Math.sin(e.wingPhase) * (isTank ? 6 : 12);
    ctx.fillStyle = isScout ? '#b91c1c' : (isTank ? '#334155' : '#3e842e');
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = isTank ? 3.5 : 2.5;

    const wingSpan = isTank ? 34 : 24;
    // Left Wing
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-wingSpan, -10 + wingFlap);
    ctx.lineTo(-18, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Wing
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(wingSpan, -10 + wingFlap);
    ctx.lineTo(18, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pig Body
    let bodyColor = '#57b841';
    if (isTank) bodyColor = '#3f6233';
    if (isScout) bodyColor = '#dc2626';

    ctx.fillStyle = e.hurtTimer > 0 ? '#ffffff' : bodyColor;
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = isTank ? 4.5 : 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, isTank ? 26 : 18, isTank ? 23 : 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sturdy Tank Helmet & Armor Plates
    if (isTank) {
      // Iron Helmet Crest
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -10, 18, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Steel Horns / Spikes
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(-16, -12);
      ctx.lineTo(-24, -28);
      ctx.lineTo(-8, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(16, -12);
      ctx.lineTo(24, -28);
      ctx.lineTo(8, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Normal Horns / Pointy Ears
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(-17, -20);
      ctx.lineTo(-7, -14);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(12, -10);
      ctx.lineTo(17, -20);
      ctx.lineTo(7, -14);
      ctx.fill();
      ctx.stroke();
    }

    // Pig Snout
    const eyeOffset = e.facing * 3;
    let snoutColor = '#459932';
    if (isTank) snoutColor = '#475569';
    if (isScout) snoutColor = '#991b1b';

    ctx.fillStyle = e.hurtTimer > 0 ? '#ffffff' : snoutColor;
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(eyeOffset, isTank ? 5 : 3, isTank ? 11 : 8, isTank ? 7 : 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Nostrils
    ctx.fillStyle = '#151515';
    ctx.beginPath();
    ctx.arc(eyeOffset - (isTank ? 4 : 3), isTank ? 5 : 3, isTank ? 2 : 1.4, 0, Math.PI * 2);
    ctx.arc(eyeOffset + (isTank ? 4 : 3), isTank ? 5 : 3, isTank ? 2 : 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (Tanks have glowing red eyes)
    ctx.fillStyle = isTank ? '#ef4444' : '#111111';
    ctx.beginPath();
    ctx.arc(-6 + eyeOffset, -4, isTank ? 2.8 : 2, 0, Math.PI * 2);
    ctx.arc(6 + eyeOffset, -4, isTank ? 2.8 : 2, 0, Math.PI * 2);
    ctx.fill();

    // Dizzy Stars if Stunned (by Seismic Stun / Heavy Ball)
    if (e.stunTimer > 0) {
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.5;
      const starAngle = Date.now() * 0.008;
      for (let s = 0; s < 3; s++) {
        const sa = starAngle + (s * Math.PI * 2) / 3;
        const sx = Math.cos(sa) * (e.radius + 6);
        const sy = -e.radius - 12 + Math.sin(sa) * 4;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Draw wooden treasure chest matching video
  private renderChest(ctx: CanvasRenderingContext2D, c: Chest) {
    ctx.save();
    let shakeX = 0;
    if (c.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * 6;
    }
    ctx.translate(c.x + shakeX, c.y);

    // Shadow
    ctx.fillStyle = '#162b14';
    ctx.beginPath();
    ctx.ellipse(0, 14, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chest Body (Wood)
    ctx.fillStyle = '#8b4513';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-20, -14, 40, 26, 6);
    ctx.fill();
    ctx.stroke();

    // Gold Corner / Straps
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-16, -14, 6, 26);
    ctx.strokeRect(-16, -14, 6, 26);
    ctx.fillRect(10, -14, 6, 26);
    ctx.strokeRect(10, -14, 6, 26);

    // Front Metal Lock / Latch
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(4, -2);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Draw diamond XP gem matching video
  private renderGem(ctx: CanvasRenderingContext2D, g: Gem) {
    ctx.save();
    const bob = Math.sin(g.bobPhase) * 3;
    ctx.translate(g.x, g.y + bob);

    // Shadow
    ctx.fillStyle = 'rgba(22, 43, 20, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 10 - bob * 0.5, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Faceted Diamond Gem
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2.2;

    // Top Facet (Light cyan-white)
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, -3);
    ctx.lineTo(-7, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bottom Facet (Cyan)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.lineTo(7, -3);
    ctx.lineTo(0, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Draw glowing golden spell card matching video
  private renderSpellCard(ctx: CanvasRenderingContext2D, c: SpellCard) {
    ctx.save();
    const bob = Math.sin(c.bobPhase) * 4;
    ctx.translate(c.x, c.y + bob);
    ctx.rotate(c.rotation);

    // Radiant Aura Glow
    const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, 24);
    gradient.addColorStop(0, 'rgba(255, 235, 59, 0.8)');
    gradient.addColorStop(0.5, 'rgba(139, 195, 74, 0.4)');
    gradient.addColorStop(1, 'rgba(76, 175, 80, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    // Card Body
    ctx.fillStyle = '#ffd54f';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-10, -14, 20, 28, 3);
    ctx.fill();
    ctx.stroke();

    // White Center Card Glyph
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -9, 12, 18);

    ctx.restore();
  }

  // Draw burning ground patches from Fireball
  private renderFirePatch(ctx: CanvasRenderingContext2D, fp: FirePatch) {
    ctx.save();
    const progress = fp.timer / fp.maxTime;
    const alpha = Math.max(0, 0.7 * (1 - progress));

    const grad = ctx.createRadialGradient(fp.x, fp.y, 4, fp.x, fp.y, fp.radius);
    grad.addColorStop(0, `rgba(255, 240, 150, ${alpha})`);
    grad.addColorStop(0.4, `rgba(249, 115, 22, ${alpha * 0.8})`);
    grad.addColorStop(1, `rgba(185, 28, 28, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fp.x, fp.y, fp.radius, 0, Math.PI * 2);
    ctx.fill();

    // Flickering flame embers
    ctx.fillStyle = '#fef08a';
    for (let i = 0; i < 4; i++) {
      const a = (Date.now() * 0.005 + i * 1.5);
      const dist = (fp.radius * 0.5) * (0.5 + 0.5 * Math.sin(a * 2));
      ctx.beginPath();
      ctx.arc(fp.x + Math.cos(a) * dist, fp.y + Math.sin(a) * dist, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Draw the 4-corner bracket reticle [ ]
  private renderReticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save();
    ctx.translate(x, y);

    const s = size * 0.5;
    const len = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(-s, -s + len);
    ctx.lineTo(-s, -s);
    ctx.lineTo(-s + len, -s);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(s - len, -s);
    ctx.lineTo(s, -s);
    ctx.lineTo(s, -s + len);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(-s, s - len);
    ctx.lineTo(-s, s);
    ctx.lineTo(-s + len, s);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(s - len, s);
    ctx.lineTo(s, s);
    ctx.lineTo(s, s - len);
    ctx.stroke();

    ctx.restore();
  }

  // Render Nova Shockwave, Sharp Slashes, Lightning Arcs, and Meteor Blasts
  private renderAttackFX(ctx: CanvasRenderingContext2D, fx: AttackFX) {
    ctx.save();
    ctx.translate(fx.x, fx.y);

    if (fx.type === 'nova') {
      const progress = fx.timer / fx.maxTime;
      const alpha = 1.0 - progress;
      const r = fx.radius || 20;

      // Solid expanding white blast circle (matching video)
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Radiating speed lines
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 4;
      const rays = 8;
      for (let i = 0; i < rays; i++) {
        const a = (i * Math.PI * 2) / rays;
        const d1 = r + 4;
        const d2 = r + 16;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * d1, Math.sin(a) * d1);
        ctx.lineTo(Math.cos(a) * d2, Math.sin(a) * d2);
        ctx.stroke();
      }
    } else if (fx.type === 'slash' && fx.slashes) {
      const progress = fx.timer / fx.maxTime;
      const alpha = 1.0 - progress;

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';

      for (const s of fx.slashes) {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
    } else if (fx.type === 'lightning' && fx.lightningTargets) {
      const progress = fx.timer / fx.maxTime;
      const alpha = 1.0 - progress;

      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      // Draw jagged electric arcs
      for (const t of fx.lightningTargets) {
        const dx = t.x2 - t.x1;
        const dy = t.y2 - t.y1;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(3, Math.floor(dist / 35));

        ctx.beginPath();
        ctx.moveTo(t.x1 - fx.x, t.y1 - fx.y);
        for (let j = 1; j < steps; j++) {
          const ratio = j / steps;
          const jx = t.x1 + dx * ratio + (Math.random() - 0.5) * 22;
          const jy = t.y1 + dy * ratio + (Math.random() - 0.5) * 22;
          ctx.lineTo(jx - fx.x, jy - fx.y);
        }
        ctx.lineTo(t.x2 - fx.x, t.y2 - fx.y);
        ctx.stroke();
      }
    } else if (fx.type === 'meteor') {
      const progress = fx.timer / fx.maxTime;
      const alpha = 1.0 - progress;
      const r = (fx.maxRadius || 100) * progress;

      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.3, `rgba(249, 115, 22, ${alpha * 0.9})`);
      grad.addColorStop(1, `rgba(220, 38, 38, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Render bottom-left HUD text exactly matching video
  private renderHUD(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const hudY = this.height - 35;
    const hudX = 20;

    // Coins: <count>
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Coins: ${this.stats.gemsCollected}`, hudX, hudY);

    // Coin icon
    ctx.fillStyle = '#f8ca20';
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hudX + 68 + (`${this.stats.gemsCollected}`.length * 8), hudY - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Health Bar
    const hpBarW = 120;
    const hpBarH = 8;
    const hpBarY = hudY + 8;
    const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(hudX, hpBarY, hpBarW, hpBarH);

    ctx.fillStyle = hpRatio > 0.3 ? '#22c55e' : '#ef4444';
    ctx.fillRect(hudX, hpBarY, hpBarW * hpRatio, hpBarH);

    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 2;
    ctx.strokeRect(hudX, hpBarY, hpBarW, hpBarH);

    ctx.restore();
  }
}

