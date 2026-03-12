import { audio } from './audio';

export const COLORS = {
  bgTop: "#0f0c29", bgMid: "#302b63", bgBot: "#24243e",
  neonCyan: "#00f3ff", neonPink: "#ff00ea", neonGreen: "#39ff14",
  gold: "#ffd700", playerGlow: "#00f3ff", enemyGlow: "#ff003c"
};

export const GUNS: Record<string, any> = {
  pistol: { speed: 20, cost: 0, spread: 1, cooldown: 15, color: COLORS.gold, name: "BLASTER", dmg: 1 },
  smg: { speed: 25, cost: 10, spread: 1, cooldown: 5, color: COLORS.neonCyan, name: "PULSE SMG", dmg: 0.8 },
  shotgun: { speed: 18, cost: 20, spread: 5, cooldown: 30, color: "#ff5500", name: "SCATTER", dmg: 1.5 },
  rifle: { speed: 45, cost: 35, spread: 1, cooldown: 10, color: COLORS.neonGreen, name: "RAILGUN", dmg: 2.5 },
  sniper: { speed: 60, cost: 60, spread: 1, cooldown: 40, color: COLORS.neonPink, name: "LANCE", dmg: 8 },
  minigun: { speed: 30, cost: 150, spread: 2, cooldown: 3, color: "#ffffff", name: "OMEGA", dmg: 1.2 }
};

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  // React callbacks
  onStateChange: (state: 'TITLE' | 'PLAYING' | 'GAMEOVER') => void;
  onStatsChange: (stats: any) => void;
  onDamage: () => void;

  // Game State
  mode: 'TITLE' | 'PLAYING' | 'GAMEOVER' = 'TITLE';
  gameMode: 'FREE' | 'LEVELS' = 'FREE';
  currentLevel = 1;
  levelGoal = 1000; // Distance to reach in level mode
  w = 0; h = 0;
  score = 0; money = 0; health = 20; maxHealth = 20;
  camX = 0; px = 100; py = 100; vx = 0; vy = 0;
  jumpCount = 0; dashCooldown = 0; invulnTime = 0;
  lastDir = 1; shootCooldown = 0;
  mouseX = 0; mouseY = 0;
  currentGun = 'pistol';
  shopOpen = false;
  
  platforms: any[] = [];
  bullets: any[] = [];
  enemyBullets: any[] = [];
  enemies: any[] = [];
  coins: any[] = [];
  particles: any[] = [];
  trails: any[] = [];
  floatingTexts: any[] = [];
  lastLandedPlat = -1;
  lastEnemyX = 0;
  
  screenShake = 0;
  frameCount = 0;
  
  keys: Record<string, boolean> = {};
  
  mountains: any[] = [];
  mountainsBg: any[] = [];

  animationFrameId = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: any) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.onStateChange = callbacks.onStateChange;
    this.onStatsChange = callbacks.onStatsChange;
    this.onDamage = callbacks.onDamage;
    
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
    
    // Init backgrounds
    for(let i=0; i<50; i++) {
        this.mountains.push({ x: i * 150 - 500, y: Math.random() * 80 + 120 });
        this.mountainsBg.push({ x: i * 200 - 500, y: Math.random() * 120 + 200 });
    }

    this.bindInputs();
    this.loop();
  }

  resize() {
    if (!this.canvas) return;
    this.w = this.canvas.width = window.innerWidth;
    this.h = this.canvas.height = window.innerHeight;
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (this.mode === 'TITLE' && e.code === 'Enter') this.start();
      if (this.mode === 'GAMEOVER' && e.code === 'Enter') this.start();
      
      if (this.mode === 'PLAYING') {
        if (!this.shopOpen && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW')) this.triggerJump();
        if (!this.shopOpen && e.code === 'ShiftLeft') this.triggerDash();
      }
    });
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', () => { this.keys['Mouse0'] = true; });
    this.canvas.addEventListener('mouseup', () => { this.keys['Mouse0'] = false; });
  }

  triggerJump() {
    if (this.jumpCount < 2 && !this.shopOpen) {
      this.vy = -20; // Increased jump strength to 20
      this.jumpCount++;
      audio.playSfx('jump');
      this.spawnParticles(this.px, this.py + 20, COLORS.neonCyan, 15, 3);
    }
  }

  triggerDash() {
    if (this.dashCooldown <= 0 && !this.shopOpen) {
      this.vx = this.lastDir * 32;
      this.dashCooldown = 45;
      this.screenShake = 5;
      audio.playSfx('dash');
      for(let i=0; i<20; i++) this.spawnParticles(this.px, this.py, COLORS.neonPink, 1, 0.5);
    }
  }
  
  triggerShoot() {
    this.keys['KeyZ'] = true;
  }
  
  stopShoot() {
    this.keys['KeyZ'] = false;
  }

  setShop(isOpen: boolean) {
    this.shopOpen = isOpen;
  }

  buyWeapon(key: string) {
    const cost = GUNS[key].cost;
    if (this.money >= cost && this.currentGun !== key) {
      this.currentGun = key;
      this.money -= cost;
      this.shopOpen = false;
      this.spawnParticles(this.px, this.py, COLORS.neonGreen, 30, 5);
      audio.playSfx('buy');
      this.notifyStats();
    }
  }

  buyHeal() {
    if (this.money >= 15 && this.health < this.maxHealth) {
      this.health++;
      this.money -= 15;
      this.spawnParticles(this.px, this.py, COLORS.neonGreen, 30, 5);
      audio.playSfx('buy');
      this.notifyStats();
    }
  }

  start(gameMode: 'FREE' | 'LEVELS' = 'FREE', level = 1) {
    audio.init();
    audio.startBgm();
    this.mode = 'PLAYING';
    this.gameMode = gameMode;
    this.currentLevel = level;
    this.levelGoal = 1000 + (level - 1) * 500;
    this.onStateChange('PLAYING');
    
    this.px = 100; this.py = this.h / 2 - 100;
    this.vx = 0; this.vy = 0;
    this.score = 0; this.money = 0; this.health = this.maxHealth;
    this.bullets = []; this.enemyBullets = []; this.enemies = [];
    this.coins = []; this.particles = []; this.trails = []; this.floatingTexts = [];
    this.camX = 0; this.lastLandedPlat = -1; this.invulnTime = 0;
    this.lastEnemyX = 0;
    this.currentGun = "pistol"; this.shopOpen = false;
    this.platforms = [{ x: -200, y: this.h - 100, w: 1400, id: 0 }];
    
    this.notifyStats();
  }

  notifyStats() {
    this.onStatsChange({
      score: this.score,
      money: this.money,
      health: this.health,
      maxHealth: this.maxHealth,
      weapon: this.currentGun,
      gameMode: this.gameMode,
      currentLevel: this.currentLevel,
      levelGoal: this.gameMode === 'LEVELS' ? 15 : 0,
      distance: this.gameMode === 'LEVELS' ? Math.min(15, this.platforms[this.platforms.length - 1].id) : Math.floor(this.px / 10),
      boss: this.enemies.find(e => e.isBoss) ? { hp: this.enemies.find(e => e.isBoss).hp, maxHp: this.enemies.find(e => e.isBoss).maxHp, level: this.currentLevel } : null
    });
  }

  spawnParticles(x: number, y: number, color: string, count: number, speed = 8) {
    for(let i = 0; i < count; i++) {
        this.particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * speed, vy: (Math.random() - 0.5) * speed,
            life: 1.0, decay: Math.random() * 0.04 + 0.02,
            color: color, size: Math.random() * 4 + 2
        });
    }
  }

  spawnText(x: number, y: number, text: string, color = "#fff") {
    this.floatingTexts.push({ x, y, text, color, life: 1.0 });
  }

  completeLevel() {
    audio.playSfx('buy');
    
    if (this.currentLevel >= 20) {
        this.onStateChange('GAMEOVER');
        return;
    }
    
    this.currentLevel++;
    
    // Reset position and platforms
    this.px = 100; this.py = this.h / 2 - 100;
    this.vx = 0; this.vy = 0;
    this.camX = 0;
    this.platforms = [{ x: -200, y: this.h - 100, w: 1400, id: 0 }];
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.coins = [];
    this.lastLandedPlat = -1;
    
    this.spawnText(this.px, this.py - 50, "LEVEL COMPLETE!", COLORS.neonGreen);
    this.notifyStats();
  }

  update() {
    if (this.mode !== 'PLAYING') return;
    
    let statsChanged = false;

    if (!this.shopOpen) {
      if (this.invulnTime > 0) this.invulnTime--;

      if (this.keys['ArrowLeft'] || this.keys['KeyA']) { this.vx -= 1.8; this.lastDir = -1; }
      if (this.keys['ArrowRight'] || this.keys['KeyD']) { this.vx += 1.8; this.lastDir = 1; }
      
      this.vx *= 0.85; this.vy += 0.7;
      
      if (this.vx > 18) this.vx = 18; if (this.vx < -18) this.vx = -18;
      if (this.vy > 20) this.vy = 20;

      this.px += this.vx; this.py += this.vy;
      
      if (Math.abs(this.vx) > 15) {
          this.trails.push({ x: this.px, y: this.py, dir: this.lastDir, life: 1 });
      }

      this.camX += (this.px - this.camX - this.w / 3) * 0.1;
      if (this.px < this.camX + 20) { this.px = this.camX + 20; if (this.vx < 0) this.vx = 0; }
      
      if (this.shootCooldown > 0) this.shootCooldown--;
      if (this.dashCooldown > 0) this.dashCooldown--;

      if ((this.keys['KeyZ'] || this.keys['Mouse0']) && this.shootCooldown <= 0) {
          const g = GUNS[this.currentGun];
          
          // Calculate angle to mouse
          const dx = (this.mouseX + this.camX) - this.px;
          const dy = this.mouseY - this.py;
          const angle = Math.atan2(dy, dx);
          
          // Update lastDir based on aim
          this.lastDir = dx >= 0 ? 1 : -1;

          for(let i = 0; i < g.spread; i++) {
              let spreadAngle = angle + (i - (g.spread - 1) / 2) * 0.1;
              this.bullets.push({
                  x: this.px + Math.cos(angle) * 30, 
                  y: this.py + Math.sin(angle) * 30,
                  vx: Math.cos(spreadAngle) * g.speed,
                  vy: Math.sin(spreadAngle) * g.speed,
                  color: g.color, dmg: g.dmg
              });
          }
          this.shootCooldown = g.cooldown;
          this.vx -= Math.cos(angle) * 2;
          this.vy -= Math.sin(angle) * 2;
          this.screenShake = g.spread > 1 ? 4 : 2;
          audio.playSfx('shoot');
      }

      let lastPlat = this.platforms[this.platforms.length - 1];
      if (lastPlat.x < this.camX + this.w) {
          if (this.gameMode === 'FREE' || lastPlat.id < 15) {
              const plat = {
                  x: lastPlat.x + lastPlat.w + 120 + Math.random() * 250,
                  y: this.h - 180 - Math.random() * 120 + 40,
                  w: 250 + Math.random() * 400,
                  id: this.platforms.length
              };
              
              if (this.gameMode === 'LEVELS' && plat.id === 15) {
                  plat.w = 2000; // Make boss platform very wide
              }
              
              this.platforms.push(plat);
          
          let isBoss = false;
          let spawnEnemy = false;
          
          if (this.gameMode === 'LEVELS' && plat.id === 15) {
              isBoss = true;
              spawnEnemy = true;
          } else if (this.gameMode === 'FREE' && plat.id > 0 && plat.id % 20 === 0) {
              isBoss = true;
              spawnEnemy = true;
          } else if (plat.id > 0 && plat.id % 5 === 0) {
              spawnEnemy = true;
          }

          if (spawnEnemy) {
              let type = Math.random() > 0.8 ? 'heavy' : (Math.random() > 0.7 ? 'fast' : 'drone');
              let hp = 20; // Basic enemy is 20 HP
              let creditValue = 20; // Basic enemy is 20 CR
              let size = 1;
              
              if (isBoss) {
                  type = 'boss';
                  hp = 15;
                  creditValue = 15;
                  size = 2.5;
              } else {
                  if (type === 'heavy') { hp = 50; creditValue = 100; size = 1.5; }
                  if (type === 'fast') { hp = 10; creditValue = 40; size = 0.8; }

                  // Scale credits based on distance in Free Play or level in Levels mode
                  const scale = this.gameMode === 'FREE' ? Math.floor(this.px / 5000) + 1 : this.currentLevel;
                  creditValue *= scale;
              }

              this.enemies.push({
                  x: plat.x + plat.w / 2, y: plat.y - 20, // Grounded on platform
                  cooldown: 60, dir: Math.random() < 0.5 ? 1 : -1,
                  plat: plat, 
                  maxHp: hp, 
                  hp: hp,
                  type, creditValue, size,
                  isBoss
              });
          }
        }
      }

      // Enemy collisions (Stomp removed)
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        const dx = Math.abs(this.px - e.x);
        const dy = Math.abs(this.py - e.y);
        
        if (dx < 30 && dy < 30) {
          if (this.invulnTime <= 0) {
            // Take damage on collision
            this.health--;
            this.screenShake = 20;
            this.invulnTime = 60;
            audio.playSfx('hit');
            this.onDamage();
            this.spawnParticles(this.px, this.py, COLORS.enemyGlow, 30);
            statsChanged = true;
          }
        }
      }

      // Platform collisions
      this.platforms.forEach(p => {
        let playerBottom = this.py + 20; let nextBottom = playerBottom + this.vy;
        if (this.vy >= 0 && playerBottom <= p.y + 15 && nextBottom >= p.y && this.px + 15 > p.x && this.px - 15 < p.x + p.w) {
            this.py = p.y - 20; this.vy = 0; this.jumpCount = 0;
            if (this.lastLandedPlat !== p.id) { 
              this.score++; 
              this.lastLandedPlat = p.id; 
              statsChanged = true;
            }
        }
      });

      // Update particles
      for(let i = this.particles.length - 1; i >= 0; i--) {
          let p = this.particles[i];
          p.x += p.vx; p.y += p.vy; p.life -= p.decay;
          if (p.life <= 0) this.particles.splice(i, 1);
      }

      // Update trails
      for(let i = this.trails.length - 1; i >= 0; i--) {
          let t = this.trails[i];
          t.life -= 0.1;
          if (t.life <= 0) this.trails.splice(i, 1);
      }

      // Update bullets
      for(let i = this.bullets.length - 1; i >= 0; i--) {
          let b = this.bullets[i];
          b.x += b.vx;
          b.y += b.vy || 0;
          
          let hit = false;
          for(let ei = this.enemies.length - 1; ei >= 0; ei--) {
              let e = this.enemies[ei];
              if (Math.abs(b.x - e.x) < 30 && Math.abs(b.y - e.y) < 30) {
                  e.hp -= b.dmg; hit = true;
                  this.spawnParticles(b.x, b.y, b.color, 10);
                  this.spawnText(e.x + (Math.random()-0.5)*20, e.y - 30, "-" + b.dmg, b.color);
                  if (e.hp <= 0) {
                      this.spawnParticles(e.x, e.y, "#ff5500", 40); audio.playSfx('explosion');
                      this.coins.push({x: e.x, y: e.y - 20, vx: (Math.random() - 0.5) * 8, vy: -8, value: e.creditValue});
                      this.score++; this.enemies.splice(ei, 1); this.screenShake = 6;
                      
                      if (e.isBoss && this.gameMode === 'LEVELS') {
                          this.completeLevel();
                      }
                      
                      statsChanged = true;
                  }
                  break;
              }
          }
          
          if (hit || Math.abs(b.x - this.px) > this.w) this.bullets.splice(i, 1);
      }

      this.enemies.forEach(e => {
          const speed = e.type === 'fast' ? 4 : (e.type === 'heavy' ? 1 : (e.type === 'boss' ? 1.5 : 2));
          e.x += e.dir * speed;
          if (e.x < e.plat.x + 30 || e.x > e.plat.x + e.plat.w - 30) e.dir *= -1;
          
          e.cooldown--;
          if (e.cooldown <= 0 && Math.abs(e.x - this.px) < this.w) {
              let dx = this.px - e.x, dy = this.py - e.y;
              let dist = Math.hypot(dx, dy);
              
              if (e.isBoss) {
                  let spread = 4 + this.currentLevel;
                  for(let i = -spread; i <= spread; i+=3) {
                      this.enemyBullets.push({ x: e.x, y: e.y, vx: (dx/dist)*6 + (Math.random()-0.5)*2, vy: (dy/dist)*6 + i });
                  }
                  e.cooldown = 60;
                  this.screenShake = 5; audio.playSfx('shoot');
              } else {
                  this.enemyBullets.push({x: e.x, y: e.y, vx: (dx/dist)*6, vy: (dy/dist)*6});
                  e.cooldown = 90; 
              }
          }
      });

      // Update enemy bullets
      for(let i = this.enemyBullets.length - 1; i >= 0; i--) {
          let b = this.enemyBullets[i];
          b.x += b.vx; b.y += b.vy;
          
          if (this.invulnTime <= 0 && Math.abs(b.x - this.px) < 20 && Math.abs(b.y - this.py) < 25) {
              this.health--; this.screenShake = 20; this.invulnTime = 60; audio.playSfx('hit');
              this.onDamage();
              this.spawnParticles(this.px, this.py, COLORS.enemyGlow, 30);
              this.enemyBullets.splice(i, 1);
              statsChanged = true;
          } else if (b.y > this.h + 100 || b.x < this.camX - 100) {
              this.enemyBullets.splice(i, 1);
          }
      }

      // Update coins
      for(let i = this.coins.length - 1; i >= 0; i--) {
          let c = this.coins[i];
          c.vy += 0.4; c.x += c.vx; c.y += c.vy;
          
          this.platforms.forEach(p => {
              if (c.vy > 0 && c.y + 8 >= p.y && c.y + 8 <= p.y + 15 && c.x > p.x && c.x < p.x + p.w) {
                  c.y = p.y - 8; c.vy *= -0.6; c.vx *= 0.8;
              }
          });
          
          let dist = Math.hypot(c.x - this.px, c.y - this.py);
          if (dist < 150) { c.vx += (this.px - c.x) * 0.15; c.vy += (this.py - c.y) * 0.15; }

          if (dist < 30) {
              let val = c.value || 1;
              this.money += val; this.spawnParticles(c.x, c.y, COLORS.gold, 10); 
              this.spawnText(c.x, c.y - 20, `+${val} CR`, COLORS.gold);
              audio.playSfx('coin'); this.coins.splice(i, 1);
              statsChanged = true;
          }
      }
      
      // Update floating texts
      for(let i = this.floatingTexts.length - 1; i >= 0; i--) {
          let ft = this.floatingTexts[i];
          ft.y -= 1; ft.life -= 0.02;
          if (ft.life <= 0) this.floatingTexts.splice(i, 1);
      }

      // Death check
      if (this.health <= 0 || this.py > this.h + 200) {
          this.mode = 'GAMEOVER';
          this.onStateChange('GAMEOVER');
          audio.playSfx('hit');
          audio.stopBgm();
          
          let best = parseInt(localStorage.getItem("pm_best") || "0");
          if (this.score > best) {
            localStorage.setItem("pm_best", this.score.toString());
          }
      }
    }

    if (statsChanged) {
      this.notifyStats();
    }
  }

  drawBackground() {
    const ctx = this.ctx;
    let skyGrad = ctx.createLinearGradient(0, 0, 0, this.h);
    skyGrad.addColorStop(0, COLORS.bgTop);
    skyGrad.addColorStop(0.4, COLORS.bgMid);
    skyGrad.addColorStop(1, COLORS.bgBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.w/2, this.h/2 - 50);
    let sunGrad = ctx.createLinearGradient(0, -150, 0, 150);
    sunGrad.addColorStop(0, "#ffcf00");
    sunGrad.addColorStop(1, "#ff00ea");
    ctx.fillStyle = sunGrad;
    ctx.shadowBlur = 50; ctx.shadowColor = "#ff00ea";
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.globalCompositeOperation = "destination-out";
    for(let i=0; i<150; i+=20) {
        let width = i * 0.15;
        ctx.fillRect(-200, i, 400, width);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    ctx.fillStyle = "#0a0718";
    ctx.beginPath(); ctx.moveTo(0, this.h);
    for(let i=0; i<this.mountainsBg.length; i++) {
        let mx = ((this.mountainsBg[i].x - this.camX * 0.05) % (this.mountainsBg.length * 200));
        if (mx < -200) mx += this.mountainsBg.length * 200;
        ctx.lineTo(mx, this.h - this.mountainsBg[i].y);
    }
    ctx.lineTo(this.w, this.h); ctx.fill();

    ctx.fillStyle = "#110b29";
    ctx.beginPath(); ctx.moveTo(0, this.h);
    for(let i=0; i<this.mountains.length; i++) {
        let mx = ((this.mountains[i].x - this.camX * 0.15) % (this.mountains.length * 150));
        if (mx < -150) mx += this.mountains.length * 150;
        ctx.lineTo(mx, this.h - this.mountains[i].y);
    }
    ctx.lineTo(this.w, this.h); ctx.fill();
    
    ctx.strokeStyle = "rgba(255, 0, 234, 0.3)";
    ctx.lineWidth = 1;
    let gridOffset = (this.camX * 0.5) % 100;
    ctx.beginPath();
    for(let i = -100; i < this.w + 200; i += 80) {
        ctx.moveTo(this.w/2, this.h/2 + 50);
        ctx.lineTo(i - gridOffset * 2, this.h);
    }
    for(let i = this.h/2 + 50; i < this.h; i += (i - this.h/2) * 0.2 + 2) {
        ctx.moveTo(0, i); ctx.lineTo(this.w, i);
    }
    ctx.stroke();
  }

  drawCyborg(x: number, y: number, isPlayer = true, alpha = 1.0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    
    // Calculate aim angle for player
    let aimAngle = 0;
    if (isPlayer) {
      const dx = (this.mouseX + this.camX) - this.px;
      const dy = this.mouseY - this.py;
      aimAngle = Math.atan2(dy, dx);
      if (this.lastDir === -1) {
        ctx.scale(-1, 1);
        aimAngle = Math.PI - aimAngle;
      }
    } else {
      if (this.lastDir === -1 && isPlayer) ctx.scale(-1, 1);
    }
    
    if (isPlayer && this.vy < 0) {
        ctx.shadowBlur = 15; ctx.shadowColor = COLORS.neonCyan;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.moveTo(-10, 20); ctx.lineTo(-5, 40 + Math.random()*15); ctx.lineTo(0, 20); ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#222";
    ctx.strokeStyle = isPlayer ? COLORS.neonCyan : COLORS.enemyGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -15); ctx.lineTo(10, -15);
    ctx.lineTo(15, 5); ctx.lineTo(5, 20);
    ctx.lineTo(-5, 20); ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 10; ctx.shadowColor = isPlayer ? COLORS.neonCyan : COLORS.enemyGlow;
    ctx.fillStyle = isPlayer ? COLORS.neonCyan : COLORS.enemyGlow;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(2, -22, 10, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 8; ctx.shadowColor = isPlayer ? COLORS.neonPink : "#ff0000";
    ctx.fillStyle = isPlayer ? COLORS.neonPink : "#ff0000";
    ctx.beginPath(); ctx.roundRect(0, -26, 12, 6, 3); ctx.fill();
    ctx.shadowBlur = 0;

    if (isPlayer) {
        ctx.save();
        ctx.rotate(aimAngle);
        ctx.fillStyle = "#333";
        ctx.fillRect(-5, -3, 25, 6);
        ctx.fillStyle = GUNS[this.currentGun].color;
        ctx.fillRect(20, -4, 15, 4);
        ctx.shadowBlur = 10; ctx.shadowColor = GUNS[this.currentGun].color;
        ctx.fillRect(25, -2, 5, 2); 
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    ctx.restore();
  }

  drawDrone(x: number, y: number, size = 1, hp = 0, maxHp = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    
    // Bobbing removed to keep them grounded
    // let bob = Math.sin(this.frameCount / 10) * 5;
    // ctx.translate(0, bob);

    ctx.fillStyle = "#111";
    ctx.strokeStyle = COLORS.enemyGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-25, -15); ctx.lineTo(-15, 5); ctx.closePath();
    ctx.moveTo(0, 0); ctx.lineTo(25, -15); ctx.lineTo(15, 5); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 15; ctx.shadowColor = "#ff0000";
    ctx.fillStyle = "#ff0000";
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(2, -2, 2, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    if (hp > 0 && maxHp > 0 && size === 1) {
        ctx.fillStyle = "#333";
        ctx.fillRect(-15, -25, 30, 4);
        ctx.fillStyle = COLORS.enemyGlow;
        ctx.fillRect(-15, -25, 30 * (hp / maxHp), 4);
    }
    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    if (this.screenShake > 0) {
        let dx = (Math.random() - 0.5) * this.screenShake * 2;
        let dy = (Math.random() - 0.5) * this.screenShake * 2;
        ctx.translate(dx, dy);
        this.screenShake *= 0.9;
        if (this.screenShake < 0.5) this.screenShake = 0;
    }

    this.drawBackground();

    if (this.mode === 'TITLE') {
      // Draw background elements for title
      this.drawCyborg(this.w / 4, this.h / 2 + 100, true);
      this.drawDrone(this.w * 0.75, this.h / 2 + 100, 1.5);
    }
    else if (this.mode === 'PLAYING' || this.mode === 'GAMEOVER') {
      ctx.save();
      ctx.translate(-Math.round(this.camX), 0);

      this.platforms.forEach(p => {
          let platGrad = ctx.createLinearGradient(0, p.y, 0, this.h);
          platGrad.addColorStop(0, "#1a1a2e"); platGrad.addColorStop(1, "#0f0c29");
          ctx.fillStyle = platGrad; ctx.fillRect(p.x, p.y, p.w, this.h - p.y);
          
          ctx.shadowBlur = 15; ctx.shadowColor = COLORS.neonPink;
          ctx.fillStyle = COLORS.neonPink; ctx.fillRect(p.x, p.y, p.w, 4);
          ctx.shadowBlur = 0;
          
          ctx.strokeStyle = "rgba(255, 0, 234, 0.2)"; ctx.lineWidth = 1;
          ctx.beginPath();
          for(let ix = p.x; ix < p.x + p.w; ix += 40) { ctx.moveTo(ix, p.y); ctx.lineTo(ix, this.h); }
          ctx.stroke();
      });

      // Draw particles
      for(let p of this.particles) {
          ctx.globalAlpha = p.life; ctx.shadowBlur = 10; ctx.shadowColor = p.color;
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;
      }

      // Draw trails
      for(let t of this.trails) {
          let oldDir = this.lastDir; this.lastDir = t.dir; 
          this.drawCyborg(t.x, t.y, true, t.life * 0.5);
          this.lastDir = oldDir;
      }

      // Draw bullets
      for(let b of this.bullets) {
          ctx.shadowColor = b.color; ctx.shadowBlur = 15;
          ctx.fillStyle = "#FFF";
          ctx.beginPath(); ctx.roundRect(b.x, b.y - 2, 35, 4, 2); ctx.fill();
          ctx.shadowBlur = 0;
      }

      // Draw enemy bullets
      for(let b of this.enemyBullets) {
          ctx.shadowColor = COLORS.enemyGlow; ctx.shadowBlur = 15;
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
      }

      // Draw coins
      for(let c of this.coins) {
          ctx.shadowColor = COLORS.gold; ctx.shadowBlur = 15;
          ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 8, Math.abs(Math.sin(this.frameCount/10))*8 + 2, 0, 0, Math.PI*2);
          ctx.stroke(); ctx.shadowBlur = 0;
      }

      // Draw floating texts
      for(let ft of this.floatingTexts) {
          ctx.globalAlpha = ft.life; ctx.fillStyle = ft.color;
          ctx.font = "bold 16px Orbitron"; ctx.fillText(ft.text, ft.x, ft.y);
          ctx.globalAlpha = 1.0;
      }

      let playerAlpha = (this.invulnTime > 0 && this.frameCount % 10 < 5) ? 0.3 : 1.0;
      if (this.mode === 'PLAYING') {
        this.drawCyborg(this.px, this.py, true, playerAlpha);
      }
      this.enemies.forEach(e => this.drawDrone(e.x, e.y, e.size || 1, e.hp, e.maxHp));
      
      ctx.restore();
    }
  }

  loop() {
    this.frameCount++;
    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    audio.stopBgm();
  }
}
