import { PinballTable } from '../pinball/pinballTable';
import { DefenseArena } from '../defense/defenseArena';
import { sound } from '../audio';

export interface OverdriveCard {
  key: string;
  icon: string;
  title: string;
  desc: string;
  apply: (pinball: PinballTable, arena: DefenseArena) => void;
}

export class OverdriveSystem {
  public energy: number = 0;
  public maxEnergy: number = 100;
  public isReady: boolean = false;
  public activeCards: OverdriveCard[] = [];

  private cardPool: OverdriveCard[] = [
    {
      key: '1',
      icon: '⚪⚪',
      title: 'Multiball Frenzy',
      desc: 'Launches +2 magical balls onto the pinball table!',
      apply: (pinball) => {
        pinball.addMultiball(2);
      }
    },
    {
      key: '2',
      icon: '⚡',
      title: 'Tesla Overcharge',
      desc: 'All turrets deal double damage and shock surrounding foes for 8s!',
      apply: (_, arena) => {
        arena.teslaSpire.level += 2;
        sound.playTeslaZap();
        setTimeout(() => {
          arena.teslaSpire.level = Math.max(1, arena.teslaSpire.level - 2);
        }, 8000);
      }
    },
    {
      key: '3',
      icon: '🛡️',
      title: 'Gate Shield & Repair',
      desc: 'Repairs all perimeter gates by +60 HP immediately!',
      apply: (_, arena) => {
        arena.gates.forEach(g => {
          g.hp = Math.min(g.maxHp, g.hp + 60);
          arena.addDamageText('+60 HEAL', g.x, g.y, '#4ade80');
        });
        sound.playComboMilestone();
      }
    },
    {
      key: '1',
      icon: '❄️',
      title: 'Blizzard Freeze',
      desc: 'Stuns and freezes all enemies in the arena for 4 seconds!',
      apply: (_, arena) => {
        arena.enemies.forEach(e => {
          e.stunTimer = 4.0;
          arena.addDamageText('FROZEN', e.x, e.y, '#38bdf8');
        });
        sound.playComboMilestone();
      }
    },
    {
      key: '2',
      icon: '🔥',
      title: 'Dragon Firestorm',
      desc: 'Flamethrower roars continuously across the entire arena for 6s!',
      apply: (_, arena) => {
        arena.flamethrower.level += 2;
        sound.playFlamethrower();
        setTimeout(() => {
          arena.flamethrower.level = Math.max(1, arena.flamethrower.level - 2);
        }, 6000);
      }
    }
  ];

  constructor() {
    this.refreshCards();
  }

  public addEnergy(amount: number) {
    if (this.isReady) return;
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    if (this.energy >= this.maxEnergy) {
      this.isReady = true;
      this.refreshCards();
      sound.playComboMilestone();
    }
  }

  public refreshCards() {
    const shuffled = [...this.cardPool].sort(() => 0.5 - Math.random());
    this.activeCards = [
      { ...shuffled[0], key: '1' },
      { ...shuffled[1], key: '2' },
      { ...shuffled[2], key: '3' }
    ];
  }

  public triggerSlot(slot: '1' | '2' | '3', pinball: PinballTable, arena: DefenseArena): boolean {
    if (!this.isReady) return false;
    const card = this.activeCards.find(c => c.key === slot);
    if (!card) return false;

    card.apply(pinball, arena);
    this.isReady = false;
    this.energy = 0;
    return true;
  }
}
