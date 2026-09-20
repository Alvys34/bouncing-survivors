import './style.css';
import { sound } from './audio';
import { PinballTable } from './pinball/pinballTable';
import { DefenseArena } from './defense/defenseArena';
import { WaveManager, GamePhase, WorkshopUpgrade } from './systems/waveManager';
import { OverdriveSystem } from './systems/overdrive';

class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private pinball: PinballTable;
  private arena: DefenseArena;
  private waveManager: WaveManager;
  private overdrive: OverdriveSystem;

  private isRunning: boolean = false;
  private lastTime: number = 0;

  // DOM Elements - Top HUD
  private waveNumberEl = document.getElementById('wave-number')!;
  private waveTimerEl = document.getElementById('wave-timer')!;
  private coreBarFill = document.getElementById('core-bar-fill')!;
  private coreHpEl = document.getElementById('core-hp')!;
  private goldCountEl = document.getElementById('gold-count')!;
  private scoreValEl = document.getElementById('score-val')!;
  private comboValEl = document.getElementById('combo-val')!;
  private audioToggle = document.getElementById('audio-toggle')!;

  // DOM Elements - Overdrive Deck
  private energyFillEl = document.getElementById('energy-fill')!;
  private energyStatusEl = document.getElementById('energy-status')!;
  private overdriveCardsEl = document.getElementById('overdrive-cards')!;

  // DOM Elements - Plunger Hint & Modals
  private plungerHintEl = document.getElementById('plunger-hint')!;
  private workshopModal = document.getElementById('workshop-modal')!;
  private workshopGrid = document.getElementById('workshop-grid')!;
  private workshopGoldEl = document.getElementById('workshop-gold')!;
  private nextWaveBtn = document.getElementById('next-wave-btn')!;
  private nextWaveNumEl = document.getElementById('next-wave-num')!;

  private startOverlay = document.getElementById('start-overlay')!;
  private startBtn = document.getElementById('start-btn')!;
  private gameoverOverlay = document.getElementById('gameover-overlay')!;
  private gameoverStatsEl = document.getElementById('gameover-stats')!;
  private restartBtn = document.getElementById('restart-btn')!;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;

    // 1. Initialize core systems
    this.arena = new DefenseArena();
    this.pinball = new PinballTable((type, ballType, combo) => {
      this.arena.triggerPinballWeapon(type, ballType, combo);
      this.overdrive.addEnergy(10 * Math.min(3, combo));
    });

    this.waveManager = new WaveManager();
    this.overdrive = new OverdriveSystem();

    // 2. Wave Manager phase listeners
    this.waveManager.onPhaseChange = (phase: GamePhase) => {
      this.handlePhaseChange(phase);
    };

    // 3. Setup event listeners & layout
    this.setupEventListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.renderOverdriveCards();
    this.render();
  }

  private resizeCanvas() {
    const targetAspect = 16 / 9;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    let width = windowW;
    let height = windowW / targetAspect;

    if (height > windowH) {
      height = windowH;
      width = windowH * targetAspect;
    }

    // Set internal resolution (1920x1080)
    this.canvas.width = 1920;
    this.canvas.height = 1080;

    this.canvas.style.width = `${Math.floor(width)}px`;
    this.canvas.style.height = `${Math.floor(height)}px`;

    // 52% Left Arena (Fortress Defense) / 48% Right Arcade Pinball Table
    const arenaW = 1920 * 0.52;
    const pinballW = 1920 * 0.48;

    this.arena.resize(arenaW, 1080);
    this.pinball.resize(pinballW, 1080);
  }

  private setupEventListeners() {
    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;

      // Left Flipper
      if (code === 'KeyA' || code === 'ShiftLeft' || code === 'ArrowLeft') {
        this.pinball.setLeftFlipper(true);
      }
      // Right Flipper
      if (code === 'KeyD' || code === 'ShiftRight' || code === 'ArrowRight') {
        this.pinball.setRightFlipper(true);
      }
      // Plunger Charge
      if (code === 'Space') {
        e.preventDefault();
        this.pinball.startChargingPlunger();
      }
      // In-Wave Overdrives
      if (code === 'Digit1' || code === 'Numpad1') {
        this.triggerOverdrive('1');
      }
      if (code === 'Digit2' || code === 'Numpad2') {
        this.triggerOverdrive('2');
      }
      if (code === 'Digit3' || code === 'Numpad3') {
        this.triggerOverdrive('3');
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;

      if (code === 'KeyA' || code === 'ShiftLeft' || code === 'ArrowLeft') {
        this.pinball.setLeftFlipper(false);
      }
      if (code === 'KeyD' || code === 'ShiftRight' || code === 'ArrowRight') {
        this.pinball.setRightFlipper(false);
      }
      if (code === 'Space') {
        e.preventDefault();
        this.pinball.releasePlunger();
      }
    });

    // Start & Restart
    this.startBtn.addEventListener('click', () => {
      this.startOverlay.classList.add('hidden');
      this.startGame();
    });

    this.restartBtn.addEventListener('click', () => {
      this.gameoverOverlay.classList.add('hidden');
      this.restartGame();
    });

    // Audio Toggle
    this.audioToggle.addEventListener('click', () => {
      const isEnabled = sound.toggleMute();
      this.audioToggle.textContent = isEnabled ? '🔊' : '🔇';
    });

    // Workshop Next Wave Button
    this.nextWaveBtn.addEventListener('click', () => {
      this.workshopModal.classList.add('hidden');
      this.waveManager.startNextWave(this.arena, this.pinball);
    });
  }

  private triggerOverdrive(slot: '1' | '2' | '3') {
    const success = this.overdrive.triggerSlot(slot, this.pinball, this.arena);
    if (success) {
      this.renderOverdriveCards();
    }
  }

  private startGame() {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private restartGame() {
    this.arena = new DefenseArena();
    this.pinball = new PinballTable((type, ballType, combo) => {
      this.arena.triggerPinballWeapon(type, ballType, combo);
      this.overdrive.addEnergy(10 * Math.min(3, combo));
    });
    this.waveManager = new WaveManager();
    this.overdrive = new OverdriveSystem();

    this.waveManager.onPhaseChange = (phase: GamePhase) => {
      this.handlePhaseChange(phase);
    };

    const arenaW = 1920 * 0.52;
    const pinballW = 1920 * 0.48;
    this.arena.resize(arenaW, 1080);
    this.pinball.resize(pinballW, 1080);

    this.renderOverdriveCards();
    this.startGame();
  }

  private handlePhaseChange(phase: GamePhase) {
    if (phase === 'BUILD') {
      this.showWorkshopModal();
    } else if (phase === 'GAMEOVER') {
      this.showGameOverModal();
    }
  }

  private showWorkshopModal() {
    this.renderWorkshopItems();
    this.workshopGoldEl.textContent = `🪙 ${this.arena.gold}`;
    this.nextWaveNumEl.textContent = `(Wave ${this.waveManager.currentWave + 1})`;
    this.workshopModal.classList.remove('hidden');
  }

  private renderWorkshopItems() {
    this.workshopGrid.innerHTML = '';

    for (const item of this.waveManager.workshopItems) {
      const card = document.createElement('div');
      const isMaxed = item.boughtCount >= item.maxCount;
      const canAfford = this.arena.gold >= item.cost && !isMaxed;

      card.className = `upgrade-card-item ${!canAfford && !isMaxed ? 'disabled' : ''} ${isMaxed ? 'maxed' : ''}`;
      card.innerHTML = `
        <div class="upgrade-icon">${item.icon}</div>
        <div class="upgrade-title">${item.title}</div>
        <div class="upgrade-desc">${item.desc}</div>
        <div class="upgrade-level-pill">Level ${item.boughtCount} / ${item.maxCount}</div>
        <button class="upgrade-buy-btn ${isMaxed ? 'max-btn' : ''}">
          ${isMaxed ? 'MAXED OUT' : `BUY: 🪙 ${item.cost}`}
        </button>
      `;

      if (canAfford) {
        const btn = card.querySelector('.upgrade-buy-btn') as HTMLButtonElement;
        btn.addEventListener('click', () => {
          this.buyWorkshopUpgrade(item);
        });
      }

      this.workshopGrid.appendChild(card);
    }
  }

  private buyWorkshopUpgrade(item: WorkshopUpgrade) {
    const success = this.waveManager.purchaseUpgrade(item, this.arena, this.pinball);
    if (success) {
      this.workshopGoldEl.textContent = `🪙 ${this.arena.gold}`;
      this.renderWorkshopItems();
      this.updateHUD();
    }
  }

  private showGameOverModal() {
    this.isRunning = false;
    this.gameoverStatsEl.innerHTML = `
      Your Sanctuary survived <strong>${this.waveManager.currentWave}</strong> waves.<br />
      Final Pinball Score: <strong>${this.pinball.score.toLocaleString()}</strong><br />
      Scrap Gold Amassed: <strong>🪙 ${this.arena.gold}</strong>
    `;
    this.gameoverOverlay.classList.remove('hidden');
  }

  private renderOverdriveCards() {
    this.overdriveCardsEl.innerHTML = '';

    for (const card of this.overdrive.activeCards) {
      const slotEl = document.createElement('div');
      slotEl.className = `overdrive-card-slot ${this.overdrive.isReady ? 'ready' : ''}`;
      slotEl.innerHTML = `
        <div class="slot-hotkey">[ ${card.key} ]</div>
        <div class="slot-icon">${card.icon}</div>
        <div class="slot-title">${card.title}</div>
        <div class="slot-desc">${card.desc}</div>
      `;

      slotEl.addEventListener('click', () => {
        this.triggerOverdrive(card.key as '1' | '2' | '3');
      });

      this.overdriveCardsEl.appendChild(slotEl);
    }
  }

  private updateHUD() {
    // Wave & Timer
    this.waveNumberEl.textContent = `${this.waveManager.currentWave}`;
    const mins = Math.floor(this.waveManager.waveTimeRemaining / 60);
    const secs = Math.floor(this.waveManager.waveTimeRemaining % 60);
    this.waveTimerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Sanctuary Core HP
    const hpRatio = Math.max(0, this.arena.coreHp / this.arena.coreMaxHp);
    this.coreBarFill.style.width = `${Math.floor(hpRatio * 100)}%`;
    this.coreBarFill.style.backgroundColor = hpRatio > 0.35 ? '#22c55e' : '#ef4444';
    this.coreHpEl.textContent = `${Math.floor(this.arena.coreHp)}/${this.arena.coreMaxHp}`;

    // Gold & Score
    this.goldCountEl.textContent = `${this.arena.gold}`;
    this.scoreValEl.textContent = this.pinball.score.toLocaleString();
    this.comboValEl.textContent = `x${this.pinball.comboMultiplier.toFixed(1)}`;

    // Overdrive Gauge
    const energyPct = Math.min(100, Math.floor((this.overdrive.energy / this.overdrive.maxEnergy) * 100));
    this.energyFillEl.style.width = `${energyPct}%`;
    if (this.overdrive.isReady) {
      this.energyStatusEl.textContent = 'READY! PRESS [1], [2], OR [3]';
      this.energyStatusEl.style.color = '#fde047';
    } else {
      this.energyStatusEl.textContent = `CHARGE VIA BUMPERS (${energyPct}%)`;
      this.energyStatusEl.style.color = '#94a3b8';
    }

    // Toggle card slots ready status
    const cardSlots = this.overdriveCardsEl.querySelectorAll('.overdrive-card-slot');
    cardSlots.forEach(slot => {
      if (this.overdrive.isReady) {
        slot.classList.add('ready');
      } else {
        slot.classList.remove('ready');
      }
    });

    // Plunger Hint: Show if any ball is currently waiting in the plunger lane
    const playW = this.pinball.width - this.pinball.plungerWidth;
    const hasBallInPlunger = this.pinball.balls.some(b => b.x > playW && b.y > this.pinball.height * 0.6);
    if (hasBallInPlunger) {
      this.plungerHintEl.classList.remove('hidden');
    } else {
      this.plungerHintEl.classList.add('hidden');
    }
  }

  private gameLoop(time: number) {
    if (!this.isRunning) return;

    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    // 1. Always update Pinball physics (flippers, gravity, bumpers)
    this.pinball.update(dt);

    // 2. If Action Phase, update Defense Arena and Wave Spawner
    if (this.waveManager.phase === 'ACTION') {
      this.arena.update(dt);
      this.waveManager.update(dt, this.arena, this.pinball);
    }

    // 3. Update HUD
    this.updateHUD();

    // 4. Render dual viewport
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const arenaW = this.canvas.width * 0.52;

    // 1. Left 52%: Fantasy Fortress Defense Arena
    this.arena.render(this.ctx);

    // 2. Right 48%: Pinball Table
    this.pinball.render(this.ctx, arenaW, 0);

    // 3. Divider Line between Arena & Pinball
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(arenaW, 0);
    this.ctx.lineTo(arenaW, this.canvas.height);
    this.ctx.stroke();

    // Gold decorative rivets along divider
    this.ctx.fillStyle = '#eab308';
    for (let y = 30; y < this.canvas.height; y += 60) {
      this.ctx.beginPath();
      this.ctx.arc(arenaW, y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}

// Start Game Engine on load
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
