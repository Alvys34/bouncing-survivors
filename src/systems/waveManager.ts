import { DefenseArena } from '../defense/defenseArena';
import { PinballTable } from '../pinball/pinballTable';
import { sound } from '../audio';

export type GamePhase = 'ACTION' | 'BUILD' | 'GAMEOVER';

export interface WorkshopUpgrade {
  id: string;
  category: 'fortress' | 'pinball';
  icon: string;
  title: string;
  desc: string;
  cost: number;
  boughtCount: number;
  maxCount: number;
  apply: (arena: DefenseArena, pinball: PinballTable) => void;
}

export class WaveManager {
  public currentWave: number = 1;
  public waveTimeRemaining: number = 40;
  public totalWaveTime: number = 40;
  public phase: GamePhase = 'ACTION';

  private spawnCooldown: number = 0;
  public onPhaseChange?: (phase: GamePhase) => void;

  public workshopItems: WorkshopUpgrade[] = [
    {
      id: 'repair_gates',
      category: 'fortress',
      icon: '🪵',
      title: 'Reinforce All Gates',
      desc: 'Restores all 4 perimeter wooden gates to 100% full health.',
      cost: 45,
      boughtCount: 0,
      maxCount: 99,
      apply: (arena) => {
        arena.gates.forEach(g => (g.hp = g.maxHp));
      }
    },
    {
      id: 'upgrade_tesla',
      category: 'fortress',
      icon: '⚡',
      title: 'Overcharge Tesla Spire',
      desc: 'Increases West Tesla chain zap damage by +35% and adds +1 chain target.',
      cost: 60,
      boughtCount: 0,
      maxCount: 5,
      apply: (arena) => {
        arena.teslaSpire.level++;
      }
    },
    {
      id: 'upgrade_flamethrower',
      category: 'fortress',
      icon: '🔥',
      title: 'Dragonfire Nozzle',
      desc: 'Increases East Flamethrower cone range and burn damage by +30%.',
      cost: 60,
      boughtCount: 0,
      maxCount: 5,
      apply: (arena) => {
        arena.flamethrower.level++;
      }
    },
    {
      id: 'upgrade_mortar',
      category: 'fortress',
      icon: '💥',
      title: 'Heavy Mortar Shells',
      desc: 'Increases Sky-Mortar blast radius by +25% and damage by +40%.',
      cost: 75,
      boughtCount: 0,
      maxCount: 5,
      apply: (arena) => {
        arena.skyMortar.level++;
      }
    },
    {
      id: 'buy_lightning_ball',
      category: 'pinball',
      icon: '⚡⚪',
      title: 'Unlock Lightning Orb',
      desc: 'Adds a permanent hyper-fast Electric Ball to your pinball table!',
      cost: 85,
      boughtCount: 0,
      maxCount: 3,
      apply: (_, pinball) => {
        pinball.spawnBallInPlunger('lightning');
      }
    },
    {
      id: 'buy_fire_ball',
      category: 'pinball',
      icon: '🔥⚪',
      title: 'Unlock Blazing Fireball',
      desc: 'Adds a permanent Burning Orb that causes extra explosive shockwaves!',
      cost: 85,
      boughtCount: 0,
      maxCount: 3,
      apply: (_, pinball) => {
        pinball.spawnBallInPlunger('fire');
      }
    },
    {
      id: 'upgrade_flippers',
      category: 'pinball',
      icon: '🚀',
      title: 'Power Solenoid Flippers',
      desc: 'Increases flipper impulse power by +25% for lightning-fast shots.',
      cost: 50,
      boughtCount: 0,
      maxCount: 4,
      apply: (_, pinball) => {
        pinball.flipperPowerMultiplier += 0.25;
      }
    },
    {
      id: 'upgrade_bumpers',
      category: 'pinball',
      icon: '🌼',
      title: 'Supercharged Bumpers',
      desc: 'Bumpers bounce with +30% higher recoil, creating intense pinball chaos.',
      cost: 55,
      boughtCount: 0,
      maxCount: 4,
      apply: (_, pinball) => {
        pinball.bumperForceMultiplier += 0.3;
      }
    }
  ];

  constructor() {}

  public update(dt: number, arena: DefenseArena, pinball: PinballTable) {
    if (this.phase === 'GAMEOVER') return;

    if (arena.coreHp <= 0) {
      this.phase = 'GAMEOVER';
      if (this.onPhaseChange) this.onPhaseChange('GAMEOVER');
      return;
    }

    if (this.phase === 'ACTION') {
      this.waveTimeRemaining = Math.max(0, this.waveTimeRemaining - dt);

      // Spawning loop during wave
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0 && this.waveTimeRemaining > 0) {
        this.spawnCooldown = Math.max(0.6, 2.5 - this.currentWave * 0.25);
        const count = 2 + Math.min(8, Math.floor(this.currentWave * 1.5));
        arena.spawnWaveEnemies(count, this.currentWave);
      }

      // Check wave completion: time expired AND remaining enemies cleared (or <= 1)
      if (this.waveTimeRemaining <= 0 && arena.enemies.length <= 1) {
        this.endWaveAndEnterBuild(arena, pinball);
      }
    }
  }

  private endWaveAndEnterBuild(arena: DefenseArena, _pinball: PinballTable) {
    this.phase = 'BUILD';
    const bonusGold = 60 + this.currentWave * 25;
    arena.gold += bonusGold;
    sound.playComboMilestone();

    if (this.onPhaseChange) {
      this.onPhaseChange('BUILD');
    }
  }

  public startNextWave(_arena: DefenseArena, pinball: PinballTable) {
    this.currentWave++;
    this.totalWaveTime = 35 + this.currentWave * 5;
    this.waveTimeRemaining = this.totalWaveTime;
    this.phase = 'ACTION';

    // Ensure a ball is in play
    if (pinball.balls.length === 0) {
      pinball.spawnBallInPlunger('standard');
    }

    if (this.onPhaseChange) {
      this.onPhaseChange('ACTION');
    }
  }

  public purchaseUpgrade(
    item: WorkshopUpgrade,
    arena: DefenseArena,
    pinball: PinballTable
  ): boolean {
    if (arena.gold < item.cost || item.boughtCount >= item.maxCount) {
      return false;
    }

    arena.gold -= item.cost;
    item.boughtCount++;
    item.apply(arena, pinball);
    sound.playGoldPickup();
    return true;
  }
}
