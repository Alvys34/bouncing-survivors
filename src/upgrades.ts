import { BounceChamber } from './chamber';
import { SurvivorArena } from './arena';

export interface UpgradeOption {
  id: string;
  icon: string;
  title: string;
  desc: string;
  apply: (chamber: BounceChamber, arena: SurvivorArena) => void;
}

export const UPGRADES_POOL: UpgradeOption[] = [
  {
    id: 'lightning_ball',
    icon: '⚡',
    title: 'Lightning Orb',
    desc: 'Adds a hyper-fast Electric Blue Ball that arcs Chain Lightning between onscreen foes!',
    apply: (chamber) => {
      chamber.addBall('lightning');
    }
  },
  {
    id: 'fire_ball',
    icon: '🔥',
    title: 'Blazing Fireball',
    desc: 'Adds a Burning Orb that drops explosive Meteors leaving burning ground patches!',
    apply: (chamber) => {
      chamber.addBall('fire');
    }
  },
  {
    id: 'heavy_ball',
    icon: '💣',
    title: 'Heavy Cannonball',
    desc: 'Adds a heavy Iron Ball that unleashes Seismic Tremors, stunning all onscreen foes!',
    apply: (chamber) => {
      chamber.addBall('heavy');
    }
  },
  {
    id: 'extra_ball',
    icon: '⚪',
    title: '+1 Bouncing Ball',
    desc: 'Adds another classic white ball to the chamber, increasing attack rate!',
    apply: (chamber) => {
      chamber.addBall('standard');
    }
  },
  {
    id: 'turbo_ball',
    icon: '🚀',
    title: 'Turbo Momentum',
    desc: 'Increases all bouncing balls speed by +25% for rapid bumper triggers.',
    apply: (chamber) => {
      chamber.ballSpeedMultiplier += 0.25;
      for (const b of chamber.balls) {
        b.vx *= 1.25;
        b.vy *= 1.25;
      }
    }
  },
  {
    id: 'giant_bumpers',
    icon: '🌼',
    title: 'Giant Bumpers',
    desc: 'Increases flower bumpers size by +25% for much more frequent bounces.',
    apply: (chamber) => {
      chamber.bumperRadiusMultiplier += 0.25;
    }
  },
  {
    id: 'super_nova',
    icon: '💥',
    title: 'Super Nova',
    desc: 'Center flower shockwave radius +40% and deals +50% explosive damage.',
    apply: (_, arena) => {
      arena.stats.novaRadius = Math.floor(arena.stats.novaRadius * 1.4);
      arena.stats.novaDamage = Math.floor(arena.stats.novaDamage * 1.5);
    }
  },
  {
    id: 'razor_slashes',
    icon: '⚔️',
    title: 'Razor Slashes',
    desc: 'Corner flower slashes deal +60% damage and slice through multiple targets.',
    apply: (_, arena) => {
      arena.stats.slashDamage = Math.floor(arena.stats.slashDamage * 1.6);
      arena.stats.slashTargets += 1;
    }
  },
  {
    id: 'gem_vacuum',
    icon: '🧲',
    title: 'Gem Magnet',
    desc: 'Expands your diamond gem magnetic collection radius by +60%.',
    apply: (_, arena) => {
      arena.player.magnetRadius = Math.floor(arena.player.magnetRadius * 1.6);
    }
  },
  {
    id: 'swift_boots',
    icon: '👟',
    title: 'Swift Boots',
    desc: 'Increases Wizard movement speed by +25%.',
    apply: (_, arena) => {
      arena.player.speed = Math.floor(arena.player.speed * 1.25);
    }
  },
  {
    id: 'vitality',
    icon: '💖',
    title: 'Heart Fruit',
    desc: 'Increases Max HP by +25 and instantly restores 50 HP.',
    apply: (_, arena) => {
      arena.player.maxHp += 25;
      arena.player.hp = Math.min(arena.player.maxHp, arena.player.hp + 50);
    }
  }
];

export function getRandomUpgrades(count: number = 3): UpgradeOption[] {
  const shuffled = [...UPGRADES_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
