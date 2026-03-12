import { useState, useEffect, useRef } from 'react';
import { GameEngine, GUNS } from './game/engine';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Crosshair, Skull, Play, Trophy } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [gameState, setGameState] = useState<'TITLE' | 'PLAYING' | 'GAMEOVER' | 'LEVEL_COMPLETE' | 'BOSS_TRANSITION'>('TITLE');
  const [stats, setStats] = useState({ score: 0, money: 0, health: 10, maxHealth: 10, weapon: 'pistol', boss: null as any, gameMode: 'FREE' as 'FREE' | 'LEVELS', currentLevel: 1, levelGoal: 1000, distance: 0, abilityCooldown: 0 });
  const [shopOpen, setShopOpen] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const [bestScore, setBestScore] = useState(parseInt(localStorage.getItem('pm_best') || '0'));
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [unlockedLevel, setUnlockedLevel] = useState(parseInt(localStorage.getItem('pm_unlocked') || '1'));

  useEffect(() => {
    if (gameState === 'LEVEL_COMPLETE') {
      if (stats.currentLevel + 1 > unlockedLevel) {
        setUnlockedLevel(stats.currentLevel + 1);
        localStorage.setItem('pm_unlocked', (stats.currentLevel + 1).toString());
      }
    }
  }, [gameState, stats.currentLevel, unlockedLevel]);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, {
        onStateChange: (state: any) => {
          setGameState(state);
          if (state === 'GAMEOVER') {
            setBestScore(parseInt(localStorage.getItem('pm_best') || '0'));
          }
        },
        onStatsChange: (newStats: any) => setStats(newStats),
        onDamage: () => {
          setDamageFlash(true);
          setTimeout(() => setDamageFlash(false), 100);
        }
      });
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setShop(shopOpen);
    }
  }, [shopOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'PLAYING' && e.code === 'KeyB') {
        setShopOpen(s => !s);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Mobile Controls handlers
  const handleJump = () => engineRef.current?.triggerJump();
  const handleDash = () => engineRef.current?.triggerDash();
  const handleShootDown = () => engineRef.current?.triggerShoot();
  const handleShootUp = () => engineRef.current?.stopShoot();
  const handleLeftDown = () => { if (engineRef.current) engineRef.current.keys['ArrowLeft'] = true; };
  const handleLeftUp = () => { if (engineRef.current) engineRef.current.keys['ArrowLeft'] = false; };
  const handleRightDown = () => { if (engineRef.current) engineRef.current.keys['ArrowRight'] = true; };
  const handleRightUp = () => { if (engineRef.current) engineRef.current.keys['ArrowRight'] = false; };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-orbitron select-none">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* CRT Effects */}
      <div className="crt-overlay" />
      <div className="vignette" />
      <div className="scanline" />
      
      {/* Damage Flash */}
      <div 
        className={`absolute inset-0 bg-red-600 pointer-events-none transition-opacity duration-100 z-40 ${damageFlash ? 'opacity-40' : 'opacity-0'}`} 
      />

      {/* UI Layer */}
      <div className="absolute inset-0 z-50 pointer-events-none flex flex-col">
        
        <AnimatePresence mode="wait">
          {gameState === 'TITLE' && (
            <motion.div 
              key="title"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto"
            >
              <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4 drop-shadow-[0_0_20px_rgba(0,243,255,0.8)]" style={{ textShadow: '0 0 20px #00f3ff, 0 0 40px #00f3ff' }}>
                NEON OVERDRIVE
              </h1>
              
              <div className="flex flex-col md:flex-row gap-4 mt-8">
                {showLevelSelect ? (
                  <div className="flex flex-col items-center gap-4 w-full max-w-2xl bg-black/80 p-8 rounded-2xl border border-gray-800 backdrop-blur-md">
                    <h2 className="text-3xl font-bold text-white mb-4">SELECT LEVEL</h2>
                    <div className="grid grid-cols-5 gap-4 w-full">
                      {Array.from({ length: Math.max(20, Math.ceil(unlockedLevel / 10) * 10) }).map((_, i) => {
                        const level = i + 1;
                        const isUnlocked = level <= unlockedLevel;
                        return (
                          <button
                            key={level}
                            disabled={!isUnlocked}
                            onClick={() => {
                              setShowLevelSelect(false);
                              engineRef.current?.start('LEVELS', level);
                            }}
                            className={`p-4 rounded font-bold text-xl transition-all ${isUnlocked ? 'bg-[#ff00ea] text-white hover:bg-[#cc00bb] hover:scale-105 shadow-[0_0_15px_rgba(255,0,234,0.5)]' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                    <button 
                      className="mt-8 px-6 py-2 border border-gray-500 text-gray-400 hover:text-white hover:border-white rounded transition-colors"
                      onClick={() => setShowLevelSelect(false)}
                    >
                      BACK
                    </button>
                  </div>
                ) : (
                  <>
                    <motion.button 
                      whileHover={{ scale: 1.05, boxShadow: "0 0 20px #ff00ea" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => engineRef.current?.start('FREE')}
                      className="px-8 py-4 bg-black/50 border-2 border-[#ff00ea] text-[#ff00ea] text-xl font-bold rounded-xl flex items-center gap-3 backdrop-blur-sm cursor-pointer"
                    >
                      <Play size={24} /> FREE PLAY
                    </motion.button>

                    <motion.button 
                      whileHover={{ scale: 1.05, boxShadow: "0 0 20px #39ff14" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowLevelSelect(true)}
                      className="px-8 py-4 bg-black/50 border-2 border-[#39ff14] text-[#39ff14] text-xl font-bold rounded-xl flex items-center gap-3 backdrop-blur-sm cursor-pointer"
                    >
                      <Trophy size={24} /> LEVELS MODE
                    </motion.button>
                  </>
                )}
              </div>
              
              <div className="mt-12 p-6 bg-black/60 border border-[#00f3ff]/30 rounded-2xl backdrop-blur-md max-w-md w-full text-center">
                <h2 className="text-[#00f3ff] font-bold text-xl mb-4">SYSTEM CONTROLS</h2>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-300 text-left">
                  <div><span className="text-white font-bold">W/A/S/D</span> - Move & Jump</div>
                  <div><span className="text-white font-bold">Z</span> - Fire Weapon</div>
                  <div><span className="text-white font-bold">SHIFT</span> - Hyper-Dash</div>
                  <div><span className="text-white font-bold">B</span> - Terminal (Shop)</div>
                </div>
              </div>
            </motion.div>
          )}

          {(gameState === 'PLAYING' || gameState === 'BOSS_TRANSITION') && (
            <motion.div 
              key="hud"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 p-4 md:p-8 flex flex-col justify-between"
            >
              {/* Top HUD */}
              <div className="flex justify-between items-start">
                <div className="bg-black/80 border border-[#00f3ff]/50 rounded-xl p-4 backdrop-blur-md min-w-[200px]">
                  <div className="text-2xl font-bold text-white mb-1">SCORE // {stats.score}</div>
                  <div className="text-xl font-bold text-[#ffd700] mb-3">CREDITS // {stats.money}</div>
                  
                  {stats.gameMode === 'LEVELS' ? (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-[#39ff14] mb-1">
                        <span>LEVEL {stats.currentLevel}</span>
                        <span>{Math.floor((stats.distance / stats.levelGoal) * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#39ff14] shadow-[0_0_10px_#39ff14]" 
                          style={{ width: `${Math.min(100, (stats.distance / stats.levelGoal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#ff00ea] mb-3 font-bold tracking-widest">
                      DISTANCE // {stats.distance}M
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">SYS //</span>
                    <div className="flex gap-1">
                      {Array.from({ length: stats.maxHealth }).map((_, i) => (
                        <div key={i} className={`w-3 h-4 rounded-sm ${i < stats.health ? 'bg-[#39ff14] shadow-[0_0_10px_#39ff14]' : 'bg-gray-800'}`} />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-gray-400 text-sm">SMITE [E] //</span>
                    <div className="w-32 h-4 bg-gray-800 rounded-sm overflow-hidden relative">
                      <div 
                        className="h-full bg-[#ff00ea] transition-all duration-100"
                        style={{ width: `${stats.abilityCooldown <= 0 ? 100 : 100 - (stats.abilityCooldown / 180) * 100}%` }}
                      />
                      {stats.abilityCooldown <= 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
                          READY
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-4">
                  <div className="text-right hidden md:block">
                    <div className="text-gray-400 text-sm">HI-SCORE // {bestScore}</div>
                    <div className="text-[#ff00ea] text-sm mt-1 animate-pulse">[B] TERMINAL UPLINK</div>
                  </div>
                  
                  <button 
                    className="pointer-events-auto md:hidden bg-black/80 border border-[#ff00ea] text-[#ff00ea] px-4 py-2 rounded-lg font-bold flex items-center gap-2 active:bg-[#ff00ea]/20"
                    onClick={() => setShopOpen(s => !s)}
                  >
                    <ShoppingCart size={18} /> TERMINAL
                  </button>
                </div>
              </div>

              {/* Boss Health Bar */}
              {stats.boss && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
                  <div className="bg-black/80 border border-white/20 p-2 rounded-lg backdrop-blur-md">
                    <div className="text-center text-white text-sm mb-1 font-bold tracking-widest">OVERSEER MK-{stats.boss.level}</div>
                    <div className="h-4 bg-gray-900 rounded-sm overflow-hidden border border-red-900/50">
                      <div 
                        className="h-full bg-red-600 transition-all duration-200 shadow-[0_0_10px_#ff0000]"
                        style={{ width: `${Math.max(0, (stats.boss.hp / stats.boss.maxHp) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom HUD */}
              <div className="flex justify-between items-end">
                <div className="bg-black/80 border border-white/20 rounded-xl p-3 backdrop-blur-md flex items-center gap-3">
                  <Crosshair className="text-gray-400" size={20} />
                  <span className="text-sm text-gray-400">ARM //</span>
                  <span className="font-bold" style={{ color: GUNS[stats.weapon].color }}>{GUNS[stats.weapon].name}</span>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'BOSS_TRANSITION' && (
            <motion.div 
              key="boss-transition"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50 bg-black overflow-hidden"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiAvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSIjMTExIiAvPgo8L3N2Zz4=')] opacity-50 mix-blend-screen pointer-events-none"></div>
              
              <motion.div 
                initial={{ scale: 1.5, opacity: 0, y: -50 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 100 }}
                className="w-full py-16 border-y-8 border-red-600 flex flex-col items-center justify-center bg-red-900/20 backdrop-blur-sm relative"
              >
                <div className="absolute inset-0 bg-red-600/10 animate-pulse"></div>
                
                <h2 className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-700 tracking-[0.2em] drop-shadow-[0_0_40px_#ff0000] text-center relative z-10" style={{ WebkitTextStroke: '2px #ff0000' }}>
                  WARNING
                </h2>
                <h3 className="text-2xl md:text-4xl font-bold text-white tracking-[0.5em] mt-4 drop-shadow-[0_0_10px_#ffffff] relative z-10">
                  HOSTILE ENTITY DETECTED
                </h3>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'LEVEL_COMPLETE' && (
            <motion.div 
              key="level-complete"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-sm z-50"
            >
              <h2 className="text-6xl font-black text-[#39ff14] mb-2 drop-shadow-[0_0_20px_#39ff14]">LEVEL COMPLETE</h2>
              <p className="text-xl text-white mb-8">Boss Defeated!</p>
              
              <div className="flex gap-4">
                  <button 
                    className="px-8 py-4 bg-[#ff00ea] text-white font-black text-xl rounded hover:bg-white hover:text-black transition-colors shadow-[0_0_20px_rgba(255,0,234,0.5)] cursor-pointer"
                    onClick={() => engineRef.current?.nextLevel()}
                  >
                    NEXT LEVEL
                  </button>
                  <button 
                    className="px-8 py-4 border-2 border-white text-white font-black text-xl rounded hover:bg-white hover:text-black transition-colors cursor-pointer"
                    onClick={() => {
                      if (engineRef.current) {
                        engineRef.current.mode = 'TITLE';
                        engineRef.current.onStateChange('TITLE');
                      }
                    }}
                  >
                    MENU
                  </button>
              </div>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-sm"
            >
              <Skull size={64} className="text-red-600 mb-6 drop-shadow-[0_0_15px_#ff0000]" />
              <h1 className="text-5xl md:text-7xl font-black text-red-600 tracking-tighter mb-4 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">
                SYSTEM FAILURE
              </h1>
              <div className="text-2xl text-[#ffd700] mb-2 font-bold uppercase tracking-widest">
                {stats.gameMode === 'LEVELS' ? `FINAL LEVEL: ${stats.currentLevel}` : `DISTANCE: ${stats.distance}M`}
              </div>
              <div className="text-xl text-white mb-8 font-bold">
                SCORE: {stats.score} <span className="mx-4">|</span> HI-SCORE: {bestScore}
              </div>
              <motion.button 
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px #00f3ff" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => engineRef.current?.start(stats.gameMode, stats.currentLevel)}
                className="px-8 py-4 bg-black/50 border-2 border-[#00f3ff] text-[#00f3ff] text-xl font-bold rounded-xl flex items-center gap-3 backdrop-blur-sm cursor-pointer"
              >
                <Play size={24} /> REBOOT SYSTEM
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shop Overlay */}
        <AnimatePresence>
          {shopOpen && gameState === 'PLAYING' && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/40 backdrop-blur-sm p-4"
              onClick={() => setShopOpen(false)}
            >
              <div 
                className="bg-[#05050f]/95 border-4 border-[#00f3ff] rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-[0_0_30px_rgba(0,243,255,0.3)]"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-3xl md:text-4xl font-bold text-[#00f3ff] text-center mb-8 drop-shadow-[0_0_10px_#00f3ff]">
                  BLACK MARKET UPLINK
                </h2>
                
                <div className="space-y-4">
                  {Object.entries(GUNS).filter(([k]) => k !== 'pistol').map(([key, gun], idx) => {
                    const canAfford = stats.money >= gun.cost;
                    const isEquipped = stats.weapon === key;
                    return (
                      <div 
                        key={key}
                        onClick={() => engineRef.current?.buyWeapon(key)}
                        className={`flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer ${
                          isEquipped ? 'border-[#39ff14] bg-[#39ff14]/10' : 
                          canAfford ? 'border-white/20 hover:border-[#00f3ff] hover:bg-[#00f3ff]/10' : 
                          'border-white/5 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500 font-bold">[{idx + 1}]</span>
                          <span className={`font-bold text-lg ${isEquipped ? 'text-[#39ff14]' : 'text-white'}`}>{gun.name}</span>
                        </div>
                        <div className={`font-bold ${isEquipped ? 'text-[#39ff14]' : canAfford ? 'text-[#ffd700]' : 'text-gray-500'}`}>
                          {isEquipped ? 'INSTALLED' : `${gun.cost} CR`}
                        </div>
                      </div>
                    );
                  })}

                  <div 
                    onClick={() => engineRef.current?.buyHeal()}
                    className={`flex justify-between items-center p-4 rounded-xl border mt-8 transition-all cursor-pointer ${
                      stats.money >= 500 && stats.health < stats.maxHealth ? 'border-[#ff00ea] hover:bg-[#ff00ea]/10' : 'border-white/5 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 font-bold">[6]</span>
                      <span className="font-bold text-lg text-[#ff00ea]">SYSTEM REPAIR (+5 HP)</span>
                    </div>
                    <div className="font-bold text-[#ffd700]">500 CR</div>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <div className="text-2xl font-bold text-[#ffd700] mb-4">AVAILABLE FUNDS: {stats.money} CR</div>
                  <div className="text-gray-500 text-sm">Press [B] or click outside to disconnect</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Touch Controls */}
      {gameState === 'PLAYING' && !shopOpen && (
        <div className="absolute inset-0 z-40 pointer-events-none md:hidden">
          {/* Left/Right */}
          <div className="absolute bottom-6 left-4 flex gap-4">
            <button 
              className="pointer-events-auto w-16 h-16 bg-black/60 border-2 border-[#00f3ff] text-[#00f3ff] rounded-xl flex items-center justify-center text-2xl active:bg-[#00f3ff]/40 active:shadow-[0_0_15px_#00f3ff]"
              onPointerDown={handleLeftDown} onPointerUp={handleLeftUp} onPointerLeave={handleLeftUp}
            >
              ◀
            </button>
            <button 
              className="pointer-events-auto w-16 h-16 bg-black/60 border-2 border-[#00f3ff] text-[#00f3ff] rounded-xl flex items-center justify-center text-2xl active:bg-[#00f3ff]/40 active:shadow-[0_0_15px_#00f3ff]"
              onPointerDown={handleRightDown} onPointerUp={handleRightUp} onPointerLeave={handleRightUp}
            >
              ▶
            </button>
          </div>
          
          {/* Actions */}
          <div className="absolute bottom-6 right-4 flex gap-4">
            <button 
              className="pointer-events-auto w-16 h-16 bg-black/60 border-2 border-[#ff00ea] text-[#ff00ea] rounded-xl flex items-center justify-center font-bold active:bg-[#ff00ea]/40 active:shadow-[0_0_15px_#ff00ea]"
              onPointerDown={handleShootDown} onPointerUp={handleShootUp} onPointerLeave={handleShootUp}
            >
              FIRE
            </button>
            <button 
              className="pointer-events-auto w-16 h-16 bg-black/60 border-2 border-[#39ff14] text-[#39ff14] rounded-xl flex items-center justify-center font-bold active:bg-[#39ff14]/40 active:shadow-[0_0_15px_#39ff14]"
              onPointerDown={handleJump}
            >
              JUMP
            </button>
          </div>
          
          {/* Dash */}
          <div className="absolute bottom-28 right-4">
            <button 
              className="pointer-events-auto w-36 h-12 bg-black/60 border-2 border-[#ffd700] text-[#ffd700] rounded-xl flex items-center justify-center font-bold active:bg-[#ffd700]/40 active:shadow-[0_0_15px_#ffd700]"
              onPointerDown={handleDash}
            >
              DASH &gt;&gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
