// =====================================================
// White Horse Silver Spear - main.js (PixiJS build)
// Entry point: wires GameLogic events to PixiRenderer + HTML UI
// =====================================================

import { GameLogic, state, BET_LEVELS, MULT_LADDER, SYMS, spd } from './game-logic.js?v=0418c';
import { PixiRenderer } from './pixi-renderer.js?v=0418c';
import { AudioManager } from './audio-manager.js?v=0418c';

// ─── 取得 DOM 元素 ───
const $ = id => document.getElementById(id);

let renderer = null;
let autoSpinRunning = false;
let longPressTimer = null;

// ── 初始化 ────────────────────────────────────
async function init() {
  console.log('[Main] init starting...');
  renderer = new PixiRenderer($('boardCanvas'));
  
  // 優先綁定 UI 事件，確保在資源載入期間按鈕依然有反應
  _bindGameLogicEvents();
  _bindUIEvents();
  _setupAudioInit();
  console.log('[Main] Events bound');

  $('loadingOverlay').style.display = 'flex';
  try {
    await renderer.preload();
    console.log('[Main] Renderer preloaded');
  } catch (err) {
    console.error('[Main] Renderer preload failed:', err);
  }
  $('loadingOverlay').style.display = 'none';

  // Now init game logic
  await GameLogic.init();
  console.log('[Main] GameLogic initialized');

  _initJackpotAnim(); // 開始跑假的 Jackpot 滾動效果
}

// ── 邏輯層 → 渲染層 + UI 事件綁定 ───────────
function _bindGameLogicEvents() {

  // 初始盤面就緒
  GameLogic.on('gridReady', grid => {
    renderer.renderGrid(grid);
  });

  // SPIN start: blur board
  GameLogic.on('spinStart', async ({ grid, resolve }) => {
    AudioManager.playSFX('SPIN_START');
    renderer.setBoardSpinning(true);

    const isBuyFeature = grid.isBuyFeature || false;

    // 如果是購買免遊，第一輪旋轉時啟動渦輪聲（設定為循環播放以防旋轉過長）
    if (isBuyFeature) {
      AudioManager.playSFX('NEAR_WIN', true);
    }

    const onReelStop = (colIdx) => {
      AudioManager.playSFX('SPIN_STOP');
      
      // 檢查該軸是否有 Scatter，若有則播放落地聲 (優化音效層次)
      const hasScatter = grid.some(row => SYMS[row[colIdx]?.symId]?.isScatter);
      if (hasScatter) {
        AudioManager.playSFX('SCATTER_LAND');
      }

      if (isBuyFeature) {
        // 每停一輪就先停止目前的渦輪聲
        AudioManager.stopSFX('NEAR_WIN');
        
        // 修正：只有在第 4 輪之前 (0, 1, 2) 且接下來有瞇牌需求時才繼續渦輪聲
        if (colIdx < 3) {
          AudioManager.playSFX('NEAR_WIN', true);
        }
      }
    };

    await renderer.playSpinStart(grid, onReelStop);
    renderer.setBoardSpinning(false);
    
    if (resolve) resolve();
  });

  // SPIN end: unlock spin btn
  GameLogic.on('spinEnd', () => {
    renderer.setBoardSpinning(false);
    _updateSpinBtn();
    _updateAutoSpinUI();
    if (state.autoSpin && !autoSpinRunning) {
      autoSpinRunning = true;
      GameLogic.runAutoSpin().then(() => { autoSpinRunning = false; });
    }
  });

  // 狀態同步：更新所有 UI 顯示
  GameLogic.on('stateChanged', s => {
    _updateUI(s);
    if (s.mode === 'MG' && AudioManager.bgmId !== 'MG') {
      AudioManager.playBGM('MG');
    }
  });

  // 中獎動畫
  GameLogic.on('winAnimStart', winCells => {
    renderer.playWinAnim(winCells);
    AudioManager.playSFX('SYMBOL_WIN');
    
    // 只有在趙雲 (ID 8) 參與連線時才有機率播放語音
    const hasZhaoYun = winCells.some(c => state.grid[c.r][c.c]?.symId === 8);
    // 增加「上一句還沒說完」的檢查
    if (hasZhaoYun && !AudioManager.isPlaying('SYM_WIN_VO') && Math.random() > 0.4) {
      AudioManager.playVO('SYM_WIN_VO');
    }
  });

  // 消除動畫
  GameLogic.on('eliminateCells', cells => {
    renderer.playEliminateAnim(cells);
    setTimeout(() => {
      AudioManager.playSFX('ELIMINATE');
    }, spd(900)); // 對齊真正的圖騰爆炸瞬間
  });

  // Scatter 呼吸放大
  GameLogic.on('scatterBreathe', async ({ cells, resolve }) => {
    if (cells.length >= 4) {
      AudioManager.playSFX('SCATTER_RING');
    } else {
      AudioManager.playSFX('SCATTER_LAND');
    }
    
    // 表演由 renderer 執行
    await renderer.playScatterBreathe(cells);
    
    // 4 個 Scatter 是重要訊號：先停頓，再播 BinWin_Omen 火箭雨下前兆
    if (cells.length >= 4) {
      await new Promise(r => setTimeout(r, spd(600)));
      AudioManager.playSFX('OMEN'); // 在這裡播放火箭雨專屬音效
      await renderer.playBinWinOmen(); // Spine 火箭雨下，播完後接 Veo 轉場
    }
    
    resolve();
  });

  // 掉落補充渲染
  GameLogic.on('dropDown', grid => {
    renderer.playDropDownAnim(grid);
  });

  // 單格更新（趙雲技能 Wild）
  GameLogic.on('cellUpdate', ({ r, c, cell }) => {
    renderer.renderCell(r, c, cell);
  });

  // Transition overlay
  GameLogic.on('transition', ({ type, scCount, resolve }) => {
    _showTransition(type, scCount, resolve);
  });

  // 大獎宣告
  GameLogic.on('showBigWin', ({ tier, cls, amount, mult, resolve }) => {
    _showBigWin(tier, cls, amount, mult, resolve);
  });

  // 總結算
  GameLogic.on('showSettlement', ({ totalWin, spinsPlayed, resolve }) => {
    _showSettlement(totalWin, spinsPlayed, resolve);
  });

  // Jackpot effect
  GameLogic.on('jackpot', ({ jp, resolve }) => {
    renderer.flashBoard(0xffd700, 4);
    _showBigWin('阿斗覺醒 GRAND JACKPOT', 'legendary', jp, 1000, resolve);
  });

  // 火箭雨大獎預兆（贏分 >= 100x bet 時觸發）
  GameLogic.on('omenSignal', async ({ resolve }) => {
    // 根據需求：火箭雨只在 MG 時演出，FG 裡的大獎不演
    if (state.mode !== 'MG') {
      resolve();
      return;
    }
    
    AudioManager.playSFX('OMEN'); // 播放專屬的大獎預兆音效
    await renderer.playBinWinOmen();
    resolve();
  });

  // Skill label
  GameLogic.on('skillLabel', text => {
    const el = $('charSkillLabel');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    el.style.animation = 'none'; // reset animation if needed
    
    // Clear label after 2.5s
    if (el._clearTimeout) clearTimeout(el._clearTimeout);
    el._clearTimeout = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { if (el.style.opacity === '0') el.textContent = ''; }, 300);
    }, 2500);
  });

  // Log
  GameLogic.on('log', (msg) => { _log(msg); });
}

// ── UI 事件（按鈕）────────────────────────────
function _bindUIEvents() {
  // SPIN 按鈕
  $('spinBtn').addEventListener('pointerdown', _spinBtnDown);
  $('spinBtn').addEventListener('pointerup', _spinBtnUp);
  $('spinBtn').addEventListener('pointerleave', _spinBtnLeave);

  // 押注調整
  $('betMinus').addEventListener('click', () => GameLogic.changeBet(-1));
  $('betPlus').addEventListener('click', () => GameLogic.changeBet(1));

  // Turbo with active state sync
  $('turboBtn').addEventListener('click', () => {
    GameLogic.toggleTurbo();
    $('turboBtn').classList.toggle('active', state.turbo);
  });

  // 自動押注
  $('autoBtn').addEventListener('click', () => {
    GameLogic.toggleAutoSpin();
    _updateAutoSpinUI();
    if (state.autoSpin && !autoSpinRunning) {
      autoSpinRunning = true;
      GameLogic.runAutoSpin().then(() => { autoSpinRunning = false; });
    }
  });

  // 額外押注
  $('extraBetBtn').addEventListener('click', () => GameLogic.toggleExtraBet());

  // 快切模式（測試）
  const modeBtns = document.querySelectorAll('.mode-sw-btn');
  console.log(`[UI] Found ${modeBtns.length} mode-sw-btns for binding`);
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      const mode = btn.dataset.mode;
      console.log(`[UI] Mode switch button clicked: ${mode}`);
      
      // 視覺反饋：按鈕跳一下
      btn.style.transform = 'scale(1.2)';
      setTimeout(() => btn.style.transform = 'scale(1)', 100);

      GameLogic.forceMode(mode);
    });
  });

  // Buy feature: show confirmation overlay first
  $('buyFgBtn')?.addEventListener('click', () => _showBuyConfirm());
  $('buyFgBtnBar')?.addEventListener('click', () => _showBuyConfirm());
  $('closeBuyBtn')?.addEventListener('click', () => $('buyOverlay').classList.remove('show'));
  $('confirmBuyBtn')?.addEventListener('click', () => {
    $('buyOverlay').classList.remove('show');
    GameLogic.buyFeature();
  });

  // Info / 賠率表
  $('infoBtn')?.addEventListener('click', () => $('infoOverlay').classList.toggle('show'));
  $('paytableBtn')?.addEventListener('click', () => {
    _renderPaytable();
    $('paytableOverlay').classList.add('show');
  });
  $('closeInfoBtn')?.addEventListener('click', () => $('infoOverlay').classList.remove('show'));
  $('closePtBtn')?.addEventListener('click', () => $('paytableOverlay').classList.remove('show'));

  // Transitions / overlays dismiss
  $('bigWinOverlay')?.addEventListener('click', _closeBigWin);
  $('settlementOverlay')?.addEventListener('click', _closeSettlement);

  // Ripple 效果
  document.addEventListener('mousedown', e => {
    const btn = e.target.closest('.btn-ripple');
    if (btn) _createRipple(e, btn);
  });

  // LOG 收摺切換
  $('logHeader')?.addEventListener('click', () => {
    $('logContainer')?.classList.toggle('collapsed');
  });

  // 音量開關
  $('volBtn')?.addEventListener('click', () => {
    const isMuted = AudioManager.toggleMute();
    $('volBtn').textContent = isMuted ? '🔇' : '🔊';
    $('volBtn').classList.toggle('muted', isMuted);
  });
}

/**
 * ── 音訊初始化 ──────────────────────────────
 * 現代瀏覽器需要使用者互動才能啟動 AudioContext
 */
function _setupAudioInit() {
  const initAudio = () => {
    AudioManager.init();
    if (state.mode === 'MG') {
      AudioManager.playBGM('MG');
    }
    // 移除監聽器以免重複觸發
    document.removeEventListener('click', initAudio);
    document.removeEventListener('keydown', initAudio);
    console.log('[Main] User interacted, audio started');
  };
  document.addEventListener('click', initAudio);
  document.addEventListener('keydown', initAudio);
}

// ── SPIN 按鈕邏輯 ───────────────────────────
function _spinBtnDown(e) {
  if (state.spinning) return;
  if (state.autoSpin) {
    state.autoSpin = false;
    _updateAutoSpinUI();
    return;
  }
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    GameLogic.toggleAutoSpin();
    _updateAutoSpinUI();
    if (state.autoSpin && !autoSpinRunning) {
      autoSpinRunning = true;
      GameLogic.runAutoSpin().then(() => { autoSpinRunning = false; });
    }
  }, 2000);
  $('spinBtn').classList.add('charging');
}

function _spinBtnUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    $('spinBtn').classList.remove('charging');
    if (!state.spinning && !state.autoSpin) GameLogic.spin();
  } else {
    $('spinBtn').classList.remove('charging');
  }
}

function _spinBtnLeave() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    $('spinBtn').classList.remove('charging');
  }
}

// ── UI 更新 ─────────────────────────────────
function _updateUI(s) {
  _updateVal('spinCount', s.spinCount);
  _updateVal('comboCount', s.combo);
  _animateNumber('roundWin', s.roundWin);
  _animateNumber('winVal', s.roundWin);
  _animateNumber('balanceVal', s.balance);

  $('betVal').textContent = BET_LEVELS[s.betIdx].toLocaleString();

  // 購買價格
  [$('buyFgBtnSpan'), $('buyFgBtnBarSpan')].forEach(el => {
    if (el) el.textContent = (BET_LEVELS[s.betIdx] * 100).toLocaleString();
  });

  // (GRAND JACKPOT 更新已移交給獨立的 rolling 動畫處理)


  // 當前倍率
  let dm = s.totalMult;
  if (s.mode !== 'MG' && s.combo === 0) dm = s.fgBaseMult;
  $('currentMult').textContent = `×${dm}`;

  // 階梯
  const isMG = s.mode === 'MG';
  const ladderEl = $('ladderSteps');
  if (isMG) {
    ladderEl.style.display = 'grid';
    ladderEl.innerHTML = MULT_LADDER.map((v, i) =>
      `<div class="ladder-step ${i < s.combo ? 'passed' : ''} ${i === Math.min(s.combo, MULT_LADDER.length - 1) && s.combo > 0 ? 'active' : ''}">${v}x</div>`
    ).join('');
  } else {
    ladderEl.style.display = 'none';
  }

  // 模式徽章
  const badge = $('modeBadge');
  badge.className = 'mode-badge ' + s.mode.toLowerCase();
  badge.textContent = {
    MG: '⚔️ 主遊戲', FG: `🌊 長坂坡救主 FG (${s.fgLeft})`,
    SFG: `🔥 單騎救主 SFG (${s.fgLeft})`, BG: '🏆 七進七出 BG'
  }[s.mode] || s.mode;

  // 額外押注
  $('extraBetBtn').classList.toggle('active', s.extraBet);
  const eba = $('extraBetBtn')?.querySelector('.eb-amount');
  if (eba) eba.textContent = `+${Math.round(BET_LEVELS[s.betIdx] * 0.5).toLocaleString()}`;

  // FG 面板切換
  const isFG = s.mode === 'FG' || s.mode === 'SFG';
  const qb = $('qingangBox');
  const fsp = $('fgStatusPanel');
  const rpt = $('rightPanelTitle');
  const wp = document.querySelector('.ways-promo');
  
  if (qb) qb.style.display = isFG ? 'none' : 'block';
  if (fsp) fsp.style.display = isFG ? 'flex' : 'none';
  if (rpt) rpt.style.display = isFG ? 'none' : 'block';
  if (wp) wp.style.display = isFG ? 'none' : 'flex';
  if (isFG) {
    const fl = $('fgLeft2'); if (fl) fl.textContent = s.fgLeft;
    const fm = $('fgBaseMult2'); if (fm) fm.textContent = '×' + s.fgBaseMult;
    const tracker = $('swordTrackerFG');
    if (tracker) {
      Array.from(tracker.children).forEach((slot, idx) => {
        if (idx < s.qingangCount) slot.classList.add('active');
        else slot.classList.remove('active');
      });
    }
  }

  // 未開轉數掛牌
  const nfw = $('nonFgWidget');
  const nfsc = $('nonFgSpinCountVal');
  if (nfw && nfsc) {
    nfsc.textContent = s.nonFgSpinCount;
    // 只在主遊戲模式顯示
    if (s.mode === 'MG') {
      nfw.classList.remove('hidden');
    } else {
      nfw.classList.add('hidden');
    }
  }

  _updateSpinBtn();
}

function _updateSpinBtn() {
  const btn = $('spinBtn');
  btn.className = 'spin-btn btn-ripple';
  if (state.mode === 'FG') btn.classList.add('fg-btn');
  if (state.mode === 'SFG') btn.classList.add('sfg-btn');
  if (state.mode === 'BG') { btn.classList.add('bg-btn'); btn.disabled = true; }
  else btn.disabled = false;
  if (state.autoSpin) btn.classList.add('auto-spin-active');
  btn.querySelector('.spin-label').textContent = state.autoSpin ? 'STOP' : (state.mode === 'MG' ? 'SPIN' : 'FREE SPIN');
}

function _updateAutoSpinUI() {
  const ind = $('autoSpinIndicator');
  if (ind) ind.style.display = state.autoSpin ? 'flex' : 'none';
  const autoBtn = $('autoBtn');
  if (autoBtn) autoBtn.classList.toggle('active', state.autoSpin);
  _updateSpinBtn();
}

function _updateVal(id, val) {
  const el = $(id); if (el) el.textContent = val;
}

function _animateNumber(id, target) {
  const el = $(id); if (!el) return;
  const current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (current === target) return;
  const diff = target - current, dur = 800, start = Date.now();
  const step = () => {
    const elapsed = Date.now() - start, t = Math.min(elapsed / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.floor(current + diff * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── 假 Jackpot 滾動邏輯 ─────────────────────────
let _jpCurrent = 0;
let _jpMax = 0;
let _jpBase = 0;
let _jpLastUpdate = 0;
let _jpActiveBet = 0;
let _jpPauseUntil = 0;

function _initJackpotAnim() {
  const tick = (now) => {
    requestAnimationFrame(tick);
    
    const currentBet = BET_LEVELS[state.betIdx];
    // Bet 切換時，重置 Base 與 Max
    if (currentBet !== _jpActiveBet) {
      _jpActiveBet = currentBet;
      _jpMax = currentBet * 1000;
      _jpBase = currentBet * 800;
      _jpCurrent = _jpBase;
      _jpPauseUntil = 0;
    }

    if (now < _jpPauseUntil) {
      // 處於 5 秒展示期，保持在 Max 數值不跳動
      const jpEl = $('jackpotValue');
      if (jpEl) jpEl.textContent = Math.floor(_jpMax).toLocaleString();
      return;
    } else if (_jpPauseUntil !== 0 && now >= _jpPauseUntil) {
      // 展示結束，瞬間回歸 Base 並重新開始滾動
      _jpPauseUntil = 0;
      _jpCurrent = _jpBase;
      _jpLastUpdate = now;
    }

    if (now - _jpLastUpdate > 50) { // 每 50ms 推進一次
      _jpLastUpdate = now;
      
      const diff = _jpMax - _jpBase;
      const growth = (diff / 800) * (0.5 + Math.random()); // 約 40 秒跑完一輪
      
      _jpCurrent += growth;

      if (_jpCurrent >= _jpMax) {
        _jpCurrent = _jpMax;
        _jpPauseUntil = now + 5000; // 暫停 5 秒
        _triggerJpResetEffect();
      }

      const jpEl = $('jackpotValue');
      if (jpEl) jpEl.textContent = Math.floor(_jpCurrent).toLocaleString();
    }
  };
  requestAnimationFrame(tick);
}

function _triggerJpResetEffect() {
  const box = document.querySelector('.jackpot-box');
  if (!box) return;

  let count = 0;
  const pulse = () => {
    if (count >= 4) return; // 5 秒內跳動 4 次
    count++;
    
    box.style.transform = 'scale(1.08)';
    box.style.borderColor = '#ffffff';
    box.style.boxShadow = '0 0 50px #ffffff';
    
    // 金色漣漪
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.inset = '0';
    p.style.boxShadow = 'inset 0 0 40px #f5c842';
    p.style.borderRadius = '12px';
    p.style.animation = 'ripple-anim 0.8s linear'; // 減慢漣漪消散速度
    p.style.pointerEvents = 'none';
    box.appendChild(p);

    setTimeout(() => {
      box.style.transform = 'scale(1)';
      box.style.borderColor = 'var(--gold)';
      box.style.boxShadow = '';
      setTimeout(() => p.remove(), 800);
      
      if (count < 4) {
        setTimeout(pulse, 800); // 加上停留的 250ms，大約是 1.05 秒跳動一次
      }
    }, 250); // 稍微拉長放大停留的時間，讓節奏較從容
  };
  
  pulse();
}

function _log(msg) {
  const area = $('logArea');
  if (!area) return;
  const p = document.createElement('p');
  p.textContent = msg;
  area.prepend(p);
  if (area.children.length > 35) area.lastChild.remove();
}

// ── 過場影片設定（Veo 接入後，將影片路徑填入此處即可）──────────
// 格式：{ TYPE: '相對於 index.html 的影片路徑（.mp4 / .webm）' }
// 留空字串 '' 代表此模式尚未有 Veo 影片，沿用靜態圖
const _TRANS_VIDEO = {
  FG:  'assets/veo/fg_from_splash.mp4', // ✅ Veo 3 生成，以趙雲主視覺圖為基底
  SFG: '',
  BG:  '',
};

// Transition overlay - type: 'FG'|'SFG'|'BG'
const _TRANS_LABELS = {
  FG:  { title: '長坂坡救主', sub: 'FREE GAME',       spins: true  },
  SFG: { title: '單騎救主',   sub: 'SUPER FREE GAME', spins: true  },
  BG:  { title: '七進七出',   sub: '',                spins: false },
};
let _transitionTimer = null;
function _showTransition(type, scCount, resolve) {
  const info = _TRANS_LABELS[type] || { title: type, sub: '', spins: false };
  const videoSrc = _TRANS_VIDEO[type] || '';
  const videoEl  = $('transitionVideo');
  const bgEl     = $('transitionBg');

  // 清除舊計時器
  if (_transitionTimer) clearTimeout(_transitionTimer);

  const finish = () => {
    $('transitionOverlay').classList.remove('show');
    if (videoEl) {
      videoEl.pause();
      videoEl.style.opacity = '0';
      videoEl.onended = null;
      videoEl.onloadedmetadata = null;
    }
    if (_transitionTimer) clearTimeout(_transitionTimer);
    if (resolve) resolve();
  };

  // Play transition audio
  AudioManager.playSFX('TRANSITION');
  if (type === 'FG' || type === 'SFG') {
    AudioManager.playSFX('FG_TRIGGER');
    AudioManager.playVO('FG_IN_VO');
    // Start FG BGM
    setTimeout(() => AudioManager.playBGM('FG'), 1000);
  }

  if (videoSrc && videoEl) {
    // ─── 有 Veo 影片：切換至影片模式 ───────────────────────
    bgEl.style.opacity = '0'; // 隱藏靜態圖
    videoEl.src = videoSrc;
    videoEl.currentTime = 0;
    videoEl.style.opacity = '0';
    
    // 影片載入與播放邏輯
    videoEl.oncanplay = () => { videoEl.style.opacity = '1'; };
    videoEl.onended = finish; // 影片播完就關閉

    videoEl.play().catch(err => {
      console.warn('Veo 影片播放失敗，切換回靜態模式', err);
      _transitionTimer = setTimeout(finish, 3000);
    });

    // 安全計時器：避免影片載入過久或卡住
    videoEl.onloadedmetadata = () => {
      const duration = (videoEl.duration || 8) * 1000;
      if (_transitionTimer) clearTimeout(_transitionTimer);
      _transitionTimer = setTimeout(finish, duration + 1000); // 影片時長 + 1秒緩衝
    };
    // 若 metadata 沒載入的預設安全值
    _transitionTimer = setTimeout(finish, 10000);
  } else {
    // ─── 無影片：沿用靜態圖 ─────────────────────
    if (videoEl) { videoEl.pause(); videoEl.src = ''; videoEl.style.opacity = '0'; }
    bgEl.style.opacity = '1';
    bgEl.style.backgroundImage = `url('../assets/generated/baimayinqiang_zhaoyun_splash_v7.png')`;
    
    let displayMs = type === 'FG' || type === 'SFG' ? 3000 : 4000;
    _transitionTimer = setTimeout(finish, displayMs);
  }

  $('transitionTitle').textContent = info.title;
  $('transitionTitle').style.display = info.title ? 'block' : 'none';
  $('transitionSub').textContent = info.sub;
  $('transitionSub').style.display = info.sub ? 'block' : 'none';
  const spinsEl = $('transitionSpins');
  if (info.spins && scCount) {
    spinsEl.textContent = `${scCount} FREE SPINS`;
    spinsEl.style.display = 'inline-block';
  } else {
    spinsEl.style.display = 'none';
  }
  $('transitionOverlay').classList.add('show');
  
  // 爆發粒子效果：讓進 FG 的宣告更有張力
  if (type === 'FG' || type === 'SFG') {
    _spawnGlobalParticles(type === 'SFG' ? 0xd080ff : 0x00d4ff, 'super');
  }
}

// ── 全域 HTML 粒子特效（解決覆蓋與層級問題） ────────
function _spawnGlobalParticles(colorVal = 0xf5c842, tier = 'default') {
  const container = $('particles');
  if (!container) return;
  const toHex = (c) => typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
  const mainColor = toHex(colorVal);

  const configs = {
    big:        { count: 60,  vyBase: 500,  vyRand: 300, vxBase: 400, colors: [mainColor] },
    mega:       { count: 100, vyBase: 700,  vyRand: 400, vxBase: 500, colors: [mainColor, '#ffffff'] },
    super:      { count: 160, vyBase: 900,  vyRand: 500, vxBase: 600, colors: [mainColor, '#ffffff', '#00d4ff'] },
    legendary:  { count: 240, vyBase: 1100, vyRand: 600, vxBase: 800, colors: [mainColor, '#ffffff', '#00d4ff', '#ff5050'] },
    jackpot:    { count: 350, vyBase: 1400, vyRand: 700, vxBase: 1000, colors: [mainColor, '#ffffff', '#00d4ff', '#ff5050', '#d080ff'] },
    settlement: { count: 500, vyBase: 1600, vyRand: 800, vxBase: 1200, colors: [mainColor, '#ffffff', '#00d4ff', '#ff5050', '#d080ff', '#44ff66'] },
    default:    { count: 70,  vyBase: 600,  vyRand: 400, vxBase: 450, colors: [mainColor, '#00d4ff'] }
  };

  const cfg = configs[tier] || configs.default;

  for (let i = 0; i < cfg.count; i++) {
    const p = document.createElement('div');
    const isAura = Math.random() > 0.65; // 35% sword auras, 65% sparks
    const c = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    
    p.style.position = 'absolute';
    
    if (isAura) {
      // 槍氣/劍影 (Spear Aura)
      const w = 2 + Math.random() * 3;
      const h = 40 + Math.random() * 120;
      p.style.width = `${w}px`;
      p.style.height = `${h}px`;
      p.style.background = `linear-gradient(to bottom, #ffffff, ${c} 40%, transparent)`;
      p.style.borderRadius = '3px';
      if (['super', 'legendary', 'jackpot', 'settlement'].includes(tier)) {
        p.style.boxShadow = `0 0 15px ${c}, 0 0 30px ${c}`;
      }
    } else {
      // 火星 (Sparks)
      const r = 2 + Math.random() * 5;
      p.style.width = `${r * 2}px`;
      p.style.height = `${r * 2}px`;
      p.style.background = c;
      p.style.borderRadius = '50%';
      // High glow for sparks
      p.style.boxShadow = `0 0 ${r*3}px ${c}, 0 0 ${r*6}px ${c}`;
    }
    
    // Start at bottom of screen
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * window.innerWidth * 0.8;
    const startY = window.innerHeight + (isAura ? 100 : 20); // Aura start slightly lower
    p.style.left = startX + 'px';
    p.style.top = startY + 'px';
    
    container.appendChild(p);

    const vx = (Math.random() - 0.5) * cfg.vxBase;
    const baseVy = -(cfg.vyBase + Math.random() * cfg.vyRand); 
    
    // Aura flies much faster and shorter life, sparks linger and fall
    const vy = isAura ? baseVy * (1.5 + Math.random()) : baseVy;
    const life = isAura ? (700 + Math.random() * 400) : (1400 + Math.random() * 800); 
    const born = performance.now();
    let rot = isAura ? 0 : Math.random() * 360;

    const tick = () => {
      const elapsed = performance.now() - born;
      const t = Math.min(elapsed / life, 1);
      
      const curX = vx * t;
      // Sparks have gravity, auras shoot up straight
      const curY = isAura ? (vy * t) : (vy * t + 1200 * t * t);
      
      if (isAura) {
        // Point in direction of travel
        rot = Math.atan2(vy, vx) * 180 / Math.PI + 90;
      } else {
        rot += 6; // spinning spark
      }
      
      p.style.transform = `translate(${curX}px, ${curY}px) rotate(${rot}deg)`;
      p.style.opacity = isAura ? (1 - Math.pow(t, 3)) : (1 - Math.pow(t, 2));

      if (t < 1) requestAnimationFrame(tick);
      else p.remove();
    };
    requestAnimationFrame(tick);
  }
}

// ── 大獎宣告（HTML Overlay）────────────────
let _bigWinResolve = null, _bigWinFallback = null;
function _showBigWin(tier, cls, amount, mult, resolve) {
  _bigWinResolve = resolve;
  $('bigWinBg').style.backgroundImage = `url('../../assets/generated/baimayinqiang_perf_bigwin_layout.png')`;
  const tierEl = $('bigWinTier');
  tierEl.textContent = tier;
  tierEl.className = `bigwin-tier ${cls}`;
  const amtEl = $('bigWinAmount');
  let cur = 0;
  
  // 根據四大獎等級決定音效 ID，以便獲取時長
  let audioId = 'BIG_WIN';
  if (cls === 'mega') audioId = 'MEGA_WIN';
  else if (cls === 'super') audioId = 'SUPER_WIN';
  else if (cls === 'legendary') audioId = 'LEGENDARY_WIN';

  // 跑分時間同步：設定為音效長度的 80% (毫秒)，剩餘 20% 為定格展示時間
  const audioDur = AudioManager.getDuration(audioId);
  const dur = Math.max(2000, audioDur * 800); // 至少 2 秒跑分

  const start = Date.now();
  const update = () => {
    const t = Math.min((Date.now() - start) / dur, 1);
    const e = 1 - Math.pow(2, -10 * t);
    cur = Math.floor(amount * (t === 1 ? 1 : e));
    amtEl.textContent = cur.toLocaleString();
    if (t < 1) requestAnimationFrame(update);
    else amtEl.textContent = amount.toLocaleString();
  };
  $('bigWinOverlay').classList.add('show');
  requestAnimationFrame(update);
  let pTier = cls;
  if (tier.includes('JACKPOT')) pTier = 'jackpot';
  _spawnGlobalParticles({ legendary: 0xf5c842, super: 0xd080ff, mega: 0x00d4ff, big: 0x44ff66 }[cls] || 0xf5c842, pTier);
  _log(`🏆 ${tier}！× ${mult.toFixed(1)} 倍`, true);
  
  // Play Big Win Audio based on tier
  // 自動在音效結束後關閉宣告頁
  const onAudioEnd = () => _closeBigWin();

  if (cls === 'mega') {
    AudioManager.playSFX('MEGA_WIN', false, onAudioEnd);
  } else if (cls === 'super') {
    AudioManager.playSFX('SUPER_WIN', false, onAudioEnd);
  } else if (cls === 'legendary') {
    AudioManager.playSFX('LEGENDARY_WIN', false, onAudioEnd);
  } else {
    AudioManager.playBGM('BIG_WIN', false, onAudioEnd);
  }

  if (_bigWinFallback) clearTimeout(_bigWinFallback);
  // 安全備份計時器 (30秒)，避免音效沒載入導致卡住
  _bigWinFallback = setTimeout(() => _closeBigWin(), 30000);
}
function _closeBigWin() {
  if (_bigWinFallback) { clearTimeout(_bigWinFallback); _bigWinFallback = null; }
  $('bigWinOverlay').classList.remove('show');

  // Stop tier sounds if needed (mostly BGMs)
  if (AudioManager.bgmId === 'BIG_WIN') {
    AudioManager.stopBGM();
  }
  AudioManager.stopSFX('MEGA_WIN');
  AudioManager.stopSFX('SUPER_WIN');
  AudioManager.stopSFX('LEGENDARY_WIN');
  
  if (_bigWinResolve) { _bigWinResolve(); _bigWinResolve = null; }
}

// ── 總結算（HTML Overlay）────────────────
let _settlementResolve = null, _settleFallback = null;
function _showSettlement(totalWin, spinsPlayed, resolve) {
  _settlementResolve = resolve;
  $('settleWinVal').textContent = '0';
  $('settleSpinVal').textContent = spinsPlayed;
  $('settleBg').style.backgroundImage = `url('../../assets/generated/baimayinqiang_perf_bigwin_layout.png')`;
  
  // 跑分時間同步：設定為音效長度的 80% (毫秒)
  const audioDur = AudioManager.getDuration('SETTLEMENT');
  const dur = Math.max(1500, audioDur * 800); 

  $('settlementOverlay').classList.add('show');
  let cur = 0;
  const start = Date.now();
  const update = () => {
    const t = Math.min((Date.now() - start) / dur, 1);
    const e = 1 - Math.pow(2, -10 * t); // 使用 easeOutExpo 讓數字跑動更平滑
    cur = Math.floor(totalWin * (t === 1 ? 1 : e));
    $('settleWinVal').textContent = cur.toLocaleString();
    if (t < 1) requestAnimationFrame(update);
    else { 
      $('settleWinVal').textContent = totalWin.toLocaleString(); 
      _spawnGlobalParticles(0xf5c842, 'settlement'); 
    }
  };
  requestAnimationFrame(update);

  // 播放結算音效並註冊結束回調
  if (_settleFallback) clearTimeout(_settleFallback);
  const onAudioEnd = () => _closeSettlement();
  AudioManager.playBGM('SETTLEMENT', false, onAudioEnd);
  
  // 安全備份計時器 (30秒)，避免音效沒載入導致卡住
  _settleFallback = setTimeout(onAudioEnd, 30000);
}
function _closeSettlement() {
  if (_settleFallback) { clearTimeout(_settleFallback); _settleFallback = null; }
  $('settlementOverlay').classList.remove('show');
  if (_settlementResolve) { _settlementResolve(); _settlementResolve = null; }
}

// ── 獎金訊息（臨時 toast） ────────────────
function _showBonusMsg(title, sub) {
  const msg = $('winMsg');
  if (!msg) return;
  $('winType').textContent = `🎊 ${sub}`;
  $('winAmount').textContent = title;
  $('winAmount').style.color = '#f5c842';
  $('winMult').textContent = '';
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2600);
}

// Buy feature confirmation popup
function _showBuyConfirm() {
  if (state.spinning || state.autoSpin || state.mode !== 'MG') return;
  const cost = BET_LEVELS[state.betIdx] * 100;
  const costEl = $('buyCostText');
  if (costEl) costEl.textContent = cost.toLocaleString();
  $('buyOverlay').classList.add('show');
}

// Paytable render - uses pre-imported SYMS
function _renderPaytable() {
  const scatters = SYMS.filter(s => s.isScatter);
  const others = SYMS.filter(s => !s.isScatter && s.odds).sort((a, b) => (b.odds[5] || 0) - (a.odds[5] || 0));
  let html = '';
  
  scatters.forEach(scatter => {
    const isGold = scatter.isGolden;
    const color = isGold ? 'var(--gold)' : 'var(--cyan)';
    // 縮短文字，幫助在兩欄排版時不換行
    const text = isGold ? '連續4軸 = 單騎救主 SFG' : '連續4軸 = 長坂坡救主 FG';
    
    // 移除 grid-column:1/-1，讓兩個阿斗能並排顯示 (1fr 1fr)。縮小圖片與內距
    html += `<div class="pt-row" style="background:linear-gradient(135deg,#1c0c3a,#0d041a); border-color:${isGold?'#f5c84255':'#00d4ff55'}; padding: 10px;">
      <div class="pt-icon"><img src="${scatter.img}" style="width:68px;height:68px;object-fit:contain;border-radius:0;${isGold ? ' mix-blend-mode: screen;' : ''}"></div>
      <div class="pt-info">
        <div class="pt-name" style="color:${color};font-size:1.05rem;text-shadow:0 0 10px ${color}66">${scatter.name}</div>
        <div class="pt-odds" style="color:var(--white);font-size:.75rem;line-height:1.2;margin-top:2px;">${text}</div>
      </div>
    </div>`;
  });
  
  html += others.map(s => `<div class="pt-row" style="padding: 10px;">
    <div class="pt-icon">${s.img ? `<img src="${s.img}" style="width:56px;height:56px;object-fit:contain;border-radius:8px">` : s.icon}</div>
    <div class="pt-info">
      <div class="pt-name" style="margin-bottom:2px; font-size: 0.9rem;">${s.name}</div>
      <div class="pt-odds" style="font-size:0.75rem; line-height:1.2;">3x: x${s.odds[3]} &nbsp; 5x: x${s.odds[5]}</div>
    </div>
  </div>`).join('');
  
  $('paytableGrid').innerHTML = html;
}

// ── Ripple 效果 ──────────────────────────
function _createRipple(e, btn) {
  const ripple = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  ripple.className = 'ripple';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// ── 啟動 ─────────────────────────────────
init();
