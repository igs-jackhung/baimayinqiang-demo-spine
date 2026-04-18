// =====================================================
// White Horse Silver Spear - game-logic.js (PixiJS build)
// Pure logic layer: zero DOM dependencies
// Communicates with renderer via EventEmitter pattern
// =====================================================

const IMG = '../../assets/generated/';
const VER = '?v=13';

export const WILD_IMG = '../../assets/generated/baimayinqiang_symbol_wild.png';

export const SYMS = [
  { id: 0, icon: 'G', img: IMG + 'baimayinqiang_symbol_token_green_muted_v4.png' + VER,   name: '\u4ee4\u724c-\u7da0', odds: { 3: 0.1, 4: 0.3, 5: 0.6 } },
  { id: 1, icon: 'R', img: IMG + 'baimayinqiang_symbol_token_red_premium.png' + VER,       name: '\u4ee4\u724c-\u7d05', odds: { 3: 0.15, 4: 0.4, 5: 0.8 } },
  { id: 2, icon: 'B', img: IMG + 'baimayinqiang_symbol_token_blue_gold_v2.png' + VER,      name: '\u4ee4\u724c-\u85cd', odds: { 3: 0.2, 4: 0.5, 5: 1.0 } },
  { id: 3, icon: 'P', img: IMG + 'baimayinqiang_symbol_token_purple_gold_v2.png' + VER,    name: '\u4ee4\u724c-\u7d2b', odds: { 3: 0.25, 4: 0.6, 5: 1.2 } },
  { id: 4, icon: 'D', img: IMG + 'baimayinqiang_symbol_drum_premium.png' + VER,            name: '\u6230\u9f13',        odds: { 3: 0.5, 4: 1.5, 5: 3.0 } },
  { id: 5, icon: 'S', img: IMG + 'baimayinqiang_symbol_sword_v3.png' + VER,                name: '青釭劍',  odds: { 3: 1.0, 4: 3.0, 5: 6.0 }, isQingang: true },
  { id: 6, icon: 'L', img: IMG + 'baimayinqiang_symbol_spear_v2.png' + VER,                name: '\u9280\u69cd',        odds: { 3: 2.0, 4: 6.0, 5: 12.0 } },
  { id: 7, icon: 'H', img: IMG + 'baimayinqiang_symbol_horse_v6.png' + VER,                name: '\u767d\u99ac',        odds: { 3: 5.0, 4: 15.0, 5: 30.0 } },
  { id: 8, icon: 'Z', img: IMG + 'baimayinqiang_symbol_zhaoyun_v7.png?v=7',                name: '\u8d99\u96f2',        odds: { 3: 10.0, 4: 30.0, 5: 60.0 } },
  { id: 9, icon: 'SC', img: IMG + 'baimayinqiang_symbol_scatter_v5.png' + VER,             name: '\u963f\u6597 (SCATTER)', isScatter: true },
  { id: 10,icon: 'W', img: WILD_IMG,                                                       name: 'WILD',                   wild: true },
  { id: 11,icon: 'GSC',img: '../../assets/generated/baimayinqiang_symbol_golden_scatter_v3.png', name: '\u9ec3\u91d1 (GOLDEN SCATTER)', isScatter: true, isGolden: true }
];

export const TRANSITION_IMG = '../../assets/generated/baimayinqiang_zhaoyun_splash_v7.png';
export const BIG_WIN_IMG = '../../assets/generated/baimayinqiang_perf_bigwin_layout.png';

export const ROWS = 4;
export const COLS = 5;
export const BET_LEVELS = [100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000];
export const MULT_LADDER = [1, 2, 3, 5, 7, 8, 10];

// ── Simple EventEmitter ───────────────────────────
class EventEmitter {
  constructor() { this._listeners = {}; }
  on(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); return this; }
  off(ev, fn) { if (this._listeners[ev]) this._listeners[ev] = this._listeners[ev].filter(f => f !== fn); }
  emit(ev, ...args) { (this._listeners[ev] || []).forEach(fn => fn(...args)); }
}

// ── Reel data ─────────────────────────────────────
let REEL_DATA = { main: null, free: null, drop_strip: null, wildodds: null, hero_trigger: null, reelchoose: null };
let REEL_PTRS = { main: [0,0,0,0,0], free: [0,0,0,0,0], drop_strip: [0,0,0,0,0] };

// ── Game state ────────────────────────────────────
export const state = {
  grid: [],
  balance: 10000000,
  betIdx: 0,
  extraBet: false,
  mode: 'MG',
  prevMode: 'MG',
  fgLeft: 0,
  fgBaseMult: 1,
  qingangCount: 0,
  totalMult: 1,
  turbo: false,
  autoSpin: false,
  spinning: false,
  spinCount: 0,
  nonFgSpinCount: 0,
  roundWin: 0,
  combo: 0,
  fgTotalWin: 0,
  fgSpinsPlayed: 0,
};

export function spd(ms) { return state.turbo ? Math.max(18, Math.round(ms / 5)) : ms; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Internal class (different name to avoid export collision) ──
class _GameLogicCore extends EventEmitter {

  async init() {
    await this._loadReelData();
    const grid = this._randomGrid();
    state.grid = grid;
    this.emit('gridReady', grid);
    this.emit('stateChanged', { ...state });
  }

  async _loadReelData() {
    try {
      const dir = state.extraBet ? '2' : '0'; // placeholder logic, standardizing for 0
      const [main, free, drop, hero, choose] = await Promise.all([
        fetch(`../../reel/0/main.json`).then(r => r.json()),
        fetch(`../../reel/0/free.json`).then(r => r.json()),
        fetch(`../../reel/0/drop_strip.json`).then(r => r.json()),
        fetch(`../../reel/0/hero_feature_trigger.json`).then(r => r.json()),
        fetch(`../../reel/0/reelchoose.json`).then(r => r.ok ? r.json() : null)
      ]);
      REEL_DATA.main = main;
      REEL_DATA.free = free;
      REEL_DATA.drop_strip = drop;
      REEL_DATA.hero_trigger = hero;
      REEL_DATA.reelchoose = choose;
      this.emit('log', '[OK] Reel data loaded');
    } catch (e) {
      this.emit('log', '[WARN] Reel data load failed, using fallback random');
    }
  }

  _randomGrid() {
    if (!REEL_DATA.main) {
      const w = [18, 16, 14, 10, 8, 6, 4, 2, 3];
      const pool = [];
      w.forEach((v, i) => { for (let k = 0; k < v; k++) pool.push(i); });
      return Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => ({ symId: pool[Math.floor(Math.random() * pool.length)], wild: false }))
      );
    }
    const isFG = state.mode === 'FG' || state.mode === 'SFG';
    const data = isFG ? REEL_DATA.free : REEL_DATA.main;
    const ptrs = isFG ? REEL_PTRS.free : REEL_PTRS.main;
    const grid = [];
    for (let r = 0; r < ROWS; r++) grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      const strip = data[c];
      const idx = Math.floor(Math.random() * strip.length);
      ptrs[c] = idx;
      for (let r = 0; r < ROWS; r++) {
        const sid = strip[(idx + r) % strip.length];
        const isWld = (sid === 10);
        grid[r][c] = {
          symId: sid,
          wild: isWld,
          multiplier: null
        };
      }
    }
    return grid;
  }



  _randomPos(grid) {
    const free = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const d = grid[r][c];
        if (!d || d.wild || SYMS[d.symId]?.isScatter) continue;
        free.push({ r, c });
      }
    return free.length > 0 ? free[Math.floor(Math.random() * free.length)] : null;
  }

  _randomSym() {
    const w = [18, 16, 14, 10, 8, 6, 4, 2, 3];
    const p = [];
    w.forEach((v, i) => { for (let k = 0; k < v; k++) p.push(i); });
    return p[Math.floor(Math.random() * p.length)];
  }

  _getNextDropSym(colIdx) {
    if (!REEL_DATA.drop_strip) return { symId: this._randomSym(), wild: false };
    const strip = REEL_DATA.drop_strip[colIdx];
    const ptr = REEL_PTRS.drop_strip[colIdx];
    const symData = strip[ptr % strip.length];
    REEL_PTRS.drop_strip[colIdx] = (ptr + 1) % strip.length;
    
    // Support JSON objects {wild: true} OR standard ID 10
    if (typeof symData === 'object' && symData.wild)
      return { symId: symData.symId, wild: true, multiplier: null };
    
    const isWld = (symData === 10);
    return { symId: symData, wild: isWld, multiplier: null };
  }

  // ── Win detection ─────────────────────────────
  findWins() {
    const winCells = [], winMap = {};
    for (const sym of SYMS) {
      if (sym.isScatter) continue;
      const colCounts = [], colPos = [];
      for (let c = 0; c < COLS; c++) {
        let cnt = 0; const cp = [];
        for (let r = 0; r < ROWS; r++) {
          const d = state.grid[r][c];
          if (!d) continue;
          if (d.wild || SYMS[d.symId]?.id === sym.id) { cnt++; cp.push({ r, c }); }
        }
        colCounts.push(cnt); colPos.push(cp);
      }
      let axisLen = 0;
      for (let c = 0; c < COLS; c++) { if (colCounts[c] >= 1) axisLen++; else break; }
      if (axisLen >= 3) {
        const cells = [];
        let totalPathMult = 0;
        const traverse = (col, currentMult) => {
          if (col === axisLen) { totalPathMult += currentMult; return; }
          colPos[col].forEach(p => {
            traverse(col + 1, currentMult);
          });
        };
        traverse(0, 1);
        for (let c = 0; c < axisLen; c++) colPos[c].forEach(p => cells.push(p));
        winMap[sym.id] = { axisLen, cells, totalPathMult };
        cells.forEach(p => winCells.push(p));
      }
    }
    const seen = {};
    return {
      winCells: winCells.filter(({ r, c }) => { const k = `${r}_${c}`; if (seen[k]) return false; seen[k] = true; return true; }),
      winMap
    };
  }

  calcWin(winMap, bet) {
    let total = 0;
    Object.entries(winMap).forEach(([sid, { axisLen, totalPathMult }]) => {
      const sym = SYMS[parseInt(sid)];
      if (!sym?.odds) return;
      const odds = sym.odds[Math.min(axisLen, 5)] || 0;
      total += bet * odds * totalPathMult * 0.1;
    });
    return Math.round(total);
  }

  // ── Main spin flow ────────────────────────────
  async spin() {
    if (state.spinning) return;
    if (state.mode === 'BG') return;
    const bet = BET_LEVELS[state.betIdx];
    const actualBet = state.extraBet ? Math.round(bet * 1.5) : bet;
    if (state.balance < actualBet) {
      this.emit('log', 'Insufficient balance');
      state.autoSpin = false;
      this.emit('stateChanged', { ...state });
      return;
    }

    state.spinning = true;
    state.balance -= actualBet;
    state.spinCount++;
    if (state.mode === 'MG') {
      state.nonFgSpinCount++;
    }
    if (state.mode === 'FG' || state.mode === 'SFG') state.fgSpinsPlayed++;
    state.roundWin = 0;
    state.combo = 0;
    state.totalMult = state.mode === 'MG' ? 1 : state.fgBaseMult;
    this.emit('stateChanged', { ...state });
    this.emit('log', `Spin #${state.spinCount} | Bet:${actualBet} | ${state.mode}`);

    let grid = this._randomGrid();

    // ── Old Version Logic: Random Wild Injection ──
    const wildChance = state.extraBet ? 0.55 : (state.mode !== 'MG' ? 0.6 : 0.3);
    if (Math.random() < wildChance) {
      const pos = this._randomPos(grid);
      if (pos) {
        grid[pos.r][pos.c].wild = true;
        grid[pos.r][pos.c].multiplier = null;
      }
    }

    await new Promise(resolve => this.emit('spinStart', { grid, resolve }));
    state.grid = grid;

    await this._cascadeLoop(actualBet);

    // Check scatters after cascade loop finishes resolving all board symbols!
    await this._checkScatters(actualBet);

    if (state.roundWin === 0 && state.mode === 'MG') {
      const hasZhaoYun = state.grid.flat().some(d => d && d.symId === 8);
      if (hasZhaoYun && REEL_DATA.hero_trigger) {
        if (Math.random() < REEL_DATA.hero_trigger.trigger_chance) {
          await this._triggerHeroFeature(actualBet);
        }
      }
    }

    if (state.mode === 'FG' || state.mode === 'SFG') {
      state.fgTotalWin += state.roundWin;
      if (state.combo >= 7) await this._triggerBG(actualBet);
      state.fgLeft--;

      // 火箭雨大獎預兆：贏分 >= 100x 押注時先觸發訊號
      if (state.roundWin >= actualBet * 100) {
        await new Promise(resolve => this.emit('omenSignal', { resolve }));
      }

      await this._showBigWin(actualBet);
      
      if (state.fgLeft <= 0) {
        await sleep(spd(600));
        await this._showSettlement(state.fgTotalWin, state.fgSpinsPlayed);
        state.mode = 'MG'; state.fgLeft = 0; state.fgBaseMult = 1; state.qingangCount = 0;
        state.fgSpinsPlayed = 0; state.fgTotalWin = 0;
      }
    } else {
      // 火箭雨大獎預兆：贏分 >= 100x 押注時先觸發訊號
      if (state.roundWin >= actualBet * 100) {
        await new Promise(resolve => this.emit('omenSignal', { resolve }));
      }

      await this._showBigWin(actualBet);
    }

    state.spinning = false;
    this.emit('stateChanged', { ...state });
    this.emit('spinEnd');
  }

  // ── Cascade loop ──────────────────────────────
  async _cascadeLoop(bet) {
    let anyWin = true;
    while (anyWin) {
      anyWin = false;
      const wins = this.findWins();
      if (wins.winCells.length > 0) {
        anyWin = true;
        state.combo++;
        if (state.mode === 'MG') {
          state.totalMult = MULT_LADDER[Math.min(state.combo - 1, MULT_LADDER.length - 1)];
        } else {
          const inc = state.mode === 'SFG' ? 2 : 1;
          state.fgBaseMult += inc;
          state.totalMult = state.fgBaseMult;
        }

        this.emit('winAnimStart', wins.winCells);
        await sleep(spd(650));

        const baseWin = this.calcWin(wins.winMap, bet);
        const actualWin = Math.round(baseWin * state.totalMult);
        state.roundWin += actualWin;
        state.balance += actualWin;

        if (state.mode === 'FG' || state.mode === 'SFG') {
          wins.winCells.forEach(({ r, c }) => {
            if (SYMS[state.grid[r][c]?.symId]?.isQingang) state.qingangCount++;
          });
          if (state.qingangCount >= 5) {
            state.qingangCount = 0;
            const jp = Math.round(bet * 1000);
            state.roundWin += jp; state.balance += jp;
            await new Promise(resolve => this.emit('jackpot', { jp, resolve }));
          }
        }

        this.emit('log', `Cascade x${state.combo} | Mult x${state.totalMult} | Win ${actualWin}`);
        this.emit('stateChanged', { ...state });
        this.emit('eliminateCells', wins.winCells);
        wins.winCells.forEach(({ r, c }) => { state.grid[r][c] = null; });
        await sleep(spd(1250));
        await this._dropDown();
      }
    }
  }

  async _dropDown() {
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let r = ROWS - 1; r >= 0; r--) if (state.grid[r][c]) col.unshift(state.grid[r][c]);
      for (let r = ROWS - 1; r >= 0; r--)
        state.grid[r][c] = col.length > 0 ? col.pop() : this._getNextDropSym(c);
    }
    this.emit('dropDown', state.grid);
    await sleep(spd(320));
  }

  // ── Scatter / FG triggers ─────────────────────
  async _checkScatters(bet) {
    let consecutiveSc = 0;
    let hasGolden = false;
    const scatterCells = [];

    // Check consecutive reels from left to right
    for (let c = 0; c < COLS; c++) {
      let reelHasScatter = false;
      for (let r = 0; r < ROWS; r++) {
        const sym = SYMS[state.grid[r][c]?.symId];
        if (sym?.isScatter) {
          reelHasScatter = true;
          scatterCells.push({r, c});
          if (sym.isGolden) hasGolden = true;
        }
      }
      if (reelHasScatter) {
        consecutiveSc++;
      } else {
        break; // Trigger must be contiguous from Reel 1
      }
    }

    if (state.mode === 'MG' && consecutiveSc >= 4) {
      await new Promise(resolve => this.emit('scatterBreathe', { cells: scatterCells, resolve }));

      // Wait 1 second to view the board clearly
      await new Promise(r => setTimeout(r, spd(1000)));

      // Golden Scatter Check -> SFG Transition!
      if (hasGolden) {
        await this._triggerSFG(consecutiveSc);
      } else {
        await this._triggerFG(consecutiveSc);
      }
    } else if ((state.mode === 'FG' || state.mode === 'SFG') && consecutiveSc >= 3) {
      await new Promise(resolve => this.emit('scatterBreathe', { cells: scatterCells, resolve }));

      state.fgLeft = Math.min(state.fgLeft + 5, 10);
      this.emit('log', `Scatter retrigger +5 spins! Remaining: ${state.fgLeft}`);
      this.emit('stateChanged', { ...state });
    }
  }

  async _triggerSFG(sc) {
    state.mode = 'SFG'; state.fgLeft = 10; state.fgBaseMult = 5; // Start natively at 5x
    state.qingangCount = 0; state.fgSpinsPlayed = 0; state.fgTotalWin = 0;
    state.nonFgSpinCount = 0; 
    this.emit('stateChanged', { ...state });
    await this._showTransition('SFG', state.fgLeft);
  }

  async _triggerFG(sc) {
    state.mode = 'FG'; state.fgLeft = 10; state.fgBaseMult = 1;
    state.qingangCount = 0; state.fgSpinsPlayed = 0; state.fgTotalWin = 0;
    state.nonFgSpinCount = 0;
    this.emit('stateChanged', { ...state });
    await this._showTransition('FG', state.fgLeft);
  }

  async _triggerBG(bet) {
    state.prevMode = state.mode;
    state.mode = 'BG';
    this.emit('stateChanged', { ...state });
    const bonusMult = Math.floor(Math.random() * 40) + 10;
    const bonusWin = Math.round(bet * bonusMult);
    this.emit('log', `BG x${bonusMult}! Cascade ${state.combo}`);
    await this._showTransition('BG', null);
    state.roundWin += bonusWin; state.balance += bonusWin;
    state.mode = state.prevMode;
    this.emit('stateChanged', { ...state });
  }

  async _triggerHeroFeature(actualBet) {
    this.emit('skillLabel', '');
    const toDestroy = REEL_DATA.hero_trigger.symbols_to_destroy;
    const targetCells = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const d = state.grid[r][c];
        if (d && toDestroy.includes(d.symId)) targetCells.push({ r, c });
      }
    if (targetCells.length > 0) {
      this.emit('winAnimStart', targetCells);
      await sleep(spd(800));
      this.emit('eliminateCells', targetCells);
      targetCells.forEach(({ r, c }) => { state.grid[r][c] = null; });
      await sleep(spd(1250));
      await this._dropDown();
      await this._cascadeLoop(actualBet);
    }
  }

  // ── Overlay events (Promise-based, resolved by UI layer) ──
  _showTransition(type, scCount) {
    return new Promise(resolve => {
      this.emit('transition', { type, scCount, resolve });
    });
  }

  _showBigWin(bet) {
    const mult = state.roundWin / bet;
    if (mult < 10) return Promise.resolve();
    let tier, cls;
    if (mult >= 50) { tier = 'LEGENDARY WIN'; cls = 'legendary'; }
    else if (mult >= 30) { tier = 'SUPER WIN'; cls = 'super'; }
    else if (mult >= 20) { tier = 'MEGA WIN'; cls = 'mega'; }
    else { tier = 'BIG WIN'; cls = 'big'; }
    return new Promise(resolve => {
      this.emit('showBigWin', { tier, cls, amount: state.roundWin, mult, resolve });
    });
  }

  _showSettlement(totalWin, spinsPlayed) {
    return new Promise(resolve => {
      this.emit('showSettlement', { totalWin, spinsPlayed, resolve });
    });
  }

  // ── Controls ──────────────────────────────────
  changeBet(dir) {
    if (state.spinning) return;
    state.betIdx = Math.max(0, Math.min(BET_LEVELS.length - 1, state.betIdx + dir));
    this.emit('stateChanged', { ...state });
  }

  toggleExtraBet() {
    if (state.spinning) return;
    state.extraBet = !state.extraBet;
    this.emit('stateChanged', { ...state });
  }

  toggleTurbo() {
    state.turbo = !state.turbo;
    this.emit('stateChanged', { ...state });
    this.emit('log', state.turbo ? 'Turbo ON (5x)' : 'Turbo OFF');
  }

  toggleAutoSpin() {
    state.autoSpin = !state.autoSpin;
    this.emit('stateChanged', { ...state });
  }

  forceMode(m) {
    console.log(`[GameLogic] forceMode requested: ${m}`);
    state.spinning = false; // 強制解除旋轉狀態
    state.autoSpin = false; // 強制停止自動旋轉
    
    // 初始化模式基本數值
    if (m === 'FG') {
      state.mode = 'FG'; state.fgLeft = 10; state.fgBaseMult = 1; state.qingangCount = 0;
      this._showTransition('FG', 10);
    } else if (m === 'SFG') {
      state.mode = 'SFG'; state.fgLeft = 10; state.fgBaseMult = 2; state.qingangCount = 0;
      this._showTransition('SFG', 10);
    } else if (m === 'BG') {
      state.mode = 'BG'; // 補上這行，確保模式正確切換
      this._showTransition('BG', null);
    } else {
      state.mode = 'MG'; state.fgLeft = 0; state.fgBaseMult = 1; state.qingangCount = 0;
    }
    
    state.totalMult = state.fgBaseMult; state.combo = 0;
    this.emit('stateChanged', { ...state });
  }

  async buyFeature() {
    if (state.spinning || state.autoSpin || state.mode !== 'MG') return false;
    const cost = BET_LEVELS[state.betIdx] * 100;
    if (state.balance < cost) { this.emit('log', 'Insufficient balance for buy'); return false; }
    
    state.spinning = true;
    state.balance -= cost;
    state.spinCount++;
    state.nonFgSpinCount++;
    state.roundWin = 0;
    state.combo = 0;
    state.totalMult = 1;
    this.emit('stateChanged', { ...state });
    this.emit('log', `Buy Feature Activated!`);

    let grid = this._randomGrid();
    grid.isBuyFeature = true;
    
    // 為了直接進入特製 FG 轉場：強制前三軸使用完全不交集的符號，且無 Wild，保證絕對不會產生贏分連線
    const nonWinPools = [
      [0, 1, 2], // 第 1 軸
      [3, 4, 5], // 第 2 軸
      [6, 7, 8], // 第 3 軸
      [1, 3, 5], // 第 4 軸
      [2, 4, 6]  // 第 5 軸
    ];

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const pool = nonWinPools[c];
        grid[r][c].symId = pool[Math.floor(Math.random() * pool.length)];
        grid[r][c].wild = false;
        grid[r][c].multiplier = null;
      }
    }
    
    // 強制在前 4 軸塞入 Scatter，觸發完美聽牌表演
    for (let c = 0; c < 4; c++) {
      let r = Math.floor(Math.random() * ROWS);
      grid[r][c].symId = 9; // SCATTER (ID 9)
    }

    await new Promise(resolve => this.emit('spinStart', { grid, resolve }));
    state.grid = grid;

    await this._cascadeLoop(BET_LEVELS[state.betIdx]);
    await this._checkScatters(BET_LEVELS[state.betIdx]);

    state.spinning = false;
    this.emit('stateChanged', { ...state });
    this.emit('spinEnd');
    
    // Auto start the first FG spin if we entered FG
    if (state.mode === 'FG' || state.mode === 'SFG') {
       await this.spin();
    }
    return true;
  }

  async runAutoSpin() {
    while (state.autoSpin) {
      if (state.mode === 'BG') { await sleep(80); continue; }
      const nextBet = BET_LEVELS[state.betIdx] * (state.extraBet ? 1.5 : 1);
      if (state.balance < nextBet) {
        state.autoSpin = false;
        this.emit('stateChanged', { ...state });
        this.emit('log', 'Auto spin stopped: insufficient balance');
        break;
      }
      await this.spin();
      if (state.autoSpin) await sleep(spd(280));
    }
  }
}

// ── Export singleton with a different name from the class ──
export const GameLogic = new _GameLogicCore();
