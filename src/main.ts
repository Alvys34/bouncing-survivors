import './style.css';
import { sound } from './audio';
import { BounceChamber } from './chamber';
import { SurvivorArena } from './arena';
import { getRandomUpgrades, UpgradeOption } from './upgrades';

class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private chamber: BounceChamber;
  private arena: SurvivorArena;

  private isRunning: boolean = false;
  private isPausedForUpgrade: boolean = false;
  private lastTime: number = 0;

  private input = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  // DOM Elements
  private startOverlay = document.getElementById('start-overlay')!;
  private gameoverOverlay = document.getElementById('gameover-overlay')!;
  private upgradeModal = document.getElementById('upgrade-modal')!;
  private cardOptionsContainer = document.getElementById('card-options')!;
  private startBtn = document.getElementById('start-btn')!;
  private restartBtn = document.getElementById('restart-btn')!;
  private audioToggle = document.getElementById('audio-toggle')!;
  private gemCountEl = document.getElementById('gem-count')!;
  private levelCountEl = document.getElementById('level-count')!;
  private ballCountEl = document.getElementById('ball-count')!;
  private gameoverStatsEl = document.getElementById('gameover-stats')!;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;

    // Initialize systems
    this.arena = new SurvivorArena();
    this.chamber = new BounceChamber((type, _id, ballType) => {
      this.arena.triggerAttack(type, ballType);
    });

    this.arena.onCardPickup = () => this.showUpgradeModal();
    this.arena.onGameOver = () => this.triggerGameOver();

    this.setupEventListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initial render
    this.render();
  }

  private resizeCanvas() {
    // Standard 16:9 aspect ratio scaling to fit viewport
    const targetAspect = 16 / 9;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    let width = windowW;
    let height = windowW / targetAspect;

    if (height > windowH) {
      height = windowH;
      width = windowH * targetAspect;
    }

    // Set internal resolution (1920x1080 for crispness)
    this.canvas.width = 1920;
    this.canvas.height = 1080;

    // Set display style
    this.canvas.style.width = `${Math.floor(width)}px`;
    this.canvas.style.height = `${Math.floor(height)}px`;

    // Partition: Left 70% for Arena, Right 30% for Bouncing Chamber
    const arenaW = 1920 * 0.7;
    const chamberW = 1920 * 0.3;

    this.arena.resize(arenaW, 1080);
    this.chamber.resize(arenaW, 0, chamberW, 1080);
  }

  private setupEventListeners() {
    // Keyboard Input
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.up = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.down = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.up = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.down = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
    });

    // Start & Restart Buttons
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
  }

  private startGame() {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private restartGame() {
    this.arena = new SurvivorArena();
    this.chamber = new BounceChamber((type, _id, ballType) => {
      this.arena.triggerAttack(type, ballType);
    });

    this.arena.onCardPickup = () => this.showUpgradeModal();
    this.arena.onGameOver = () => this.triggerGameOver();

    const arenaW = 1920 * 0.7;
    const chamberW = 1920 * 0.3;
    this.arena.resize(arenaW, 1080);
    this.chamber.resize(arenaW, 0, chamberW, 1080);

    this.updateStatsDisplay();
    this.startGame();
  }

  private triggerGameOver() {
    this.isRunning = false;
    this.gameoverStatsEl.textContent = `You gathered ${this.arena.stats.gemsCollected} diamond gems and reached Level ${this.arena.stats.level}!`;
    this.gameoverOverlay.classList.remove('hidden');
  }

  private showUpgradeModal() {
    this.isPausedForUpgrade = true;
    this.cardOptionsContainer.innerHTML = '';

    const options = getRandomUpgrades(3);
    for (const opt of options) {
      const cardEl = document.createElement('div');
      cardEl.className = 'upgrade-card-item';
      cardEl.innerHTML = `
        <div class="upgrade-icon">${opt.icon}</div>
        <div class="upgrade-title">${opt.title}</div>
        <div class="upgrade-desc">${opt.desc}</div>
      `;

      cardEl.addEventListener('click', () => {
        this.selectUpgrade(opt);
      });

      this.cardOptionsContainer.appendChild(cardEl);
    }

    this.upgradeModal.classList.remove('hidden');
  }

  private selectUpgrade(opt: UpgradeOption) {
    opt.apply(this.chamber, this.arena);
    sound.playCardPickup();
    this.upgradeModal.classList.add('hidden');
    this.isPausedForUpgrade = false;
    this.lastTime = performance.now();
    this.updateStatsDisplay();
  }

  private updateStatsDisplay() {
    this.gemCountEl.textContent = `${this.arena.stats.gemsCollected}`;
    this.levelCountEl.textContent = `${this.arena.stats.level}`;
    this.ballCountEl.textContent = `${this.chamber.balls.length}`;
  }

  private gameLoop(time: number) {
    if (!this.isRunning) return;

    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    if (!this.isPausedForUpgrade) {
      // Update Left Arena
      this.arena.update(dt, this.input);

      // Update Right Bouncing Chamber
      this.chamber.update(dt);

      // Refresh HUD numbers
      this.updateStatsDisplay();
    }

    // Render both panes
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Render Left Arena (Survivor Game)
    this.arena.render(this.ctx);

    // 2. Render Right Chamber (Pinball Metronome)
    this.chamber.render(this.ctx);
  }
}

// Start Game Engine on load
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
