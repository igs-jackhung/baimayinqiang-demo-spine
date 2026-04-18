// =====================================================
// White Horse Silver Spear - pixi-renderer.js (PixiJS v7)
// Rendering layer: all visual output, animations, effects
// Listens to GameLogic events. Never touches game logic.
// =====================================================

// PixiJS UMD version loaded via <script> tag (window.PIXI)
const PIXI = window.PIXI;
import { SYMS, WILD_IMG, ROWS, COLS, state, spd } from './game-logic.js';

// 嚙緩嚙緩 Try to load pixi-filters for GlowFilter 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
// pixi-filters v5 嚙羯嚙踝蕭嚙編嚙踝蕭嚙箴嚙踝蕭 404嚙璀嚙箭嚙踝蕭嚙踝蕭嚙踝蕭嚙誕用歹蕭嚙踝蕭 ColorMatrixPulse
let GlowFilter = null;

// 嚙緩嚙緩 Constants 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
const CELL_W = 112;
const CELL_H = 112;
const CELL_GAP = 6;
const BOARD_PAD = 14;
const BOARD_W = COLS * CELL_W + (COLS - 1) * CELL_GAP + BOARD_PAD * 2;
const BOARD_H = ROWS * CELL_H + (ROWS - 1) * CELL_GAP + BOARD_PAD * 2;

const COLOR = {
  bg:     0x0a0c1c,
  cellBg: 0x111428,
  border: 0x44476a,
  gold:   0xf5c842,
  cyan:   0x00d4ff,
  green:  0x44ff66,
  purple: 0xd080ff,
  red:    0xff5050,
  wild:   0x221000,
};

// 嚙緩嚙緩 Easing library 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack  = t => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInCubic  = t => t * t * t;

// 嚙緩嚙緩 Tween helper (PixiJS Ticker) 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
function tween(app, { from, to, duration, easing = t => t, onUpdate, onComplete }) {
  return new Promise(resolve => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      onUpdate(from + (to - from) * easing(t));
      if (t >= 1) {
        app.ticker.remove(tick);
        if (onComplete) onComplete();
        resolve();
      }
    };
    app.ticker.add(tick);
  });
}

// 嚙緩嚙緩 Column-staggered drop helper 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
function staggeredDrop(app, sprites, fromY, dur, anticipationCols = new Set(), pixiRenderer = null, customDelays = null, customAccelerateTimes = null, targetGrid = null, onReelStop = null) {
  const promises = [];
  const globalStart = performance.now();
  const stoppedCols = new Set();

  for (let c = 0; c < COLS; c++) {
    const isAnticipating = anticipationCols.has(c);
    const delay = customDelays ? customDelays[c] : (isAnticipating ? (app.ticker.speed > 1.5 ? 600 : 2000) : c * 50); 
    const accTime = (customAccelerateTimes && customAccelerateTimes[c] !== undefined) ? customAccelerateTimes[c] : (delay - 2000);

    let spinContainer = null;
    let spinTicker = null;
    let highlighted = false;

    // 嚙課佗蕭嚙踝蕭嚙豎時塚蕭嚙磕嚙盤60ms嚙踝蕭嚙踝蕭嚙璀嚙踝蕭嚙罵嚙請建「嚙踝蕭嚙踝蕭坋e嚙踝蕭嚙緞嚙瘡嚙踝蕭{嚙瑾嚙踝蕭t嚙論梧蕭嚙踝蕭
    if (pixiRenderer && delay > 60) {
      const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
      
      spinContainer = new PIXI.Container();
      spinContainer.x = tx;
      // 嚙誕用「嚙諂迎蕭嚙褐賂蕭+嚙踝蕭嚙瘠嚙緲嚙踝蕭嚙論」嚙諉剁蕭嚙瞇嚙諉荔蕭B嚙踝蕭嚙磐嚙踝蕭嚙踝蕭嚙踝蕭 BlurFilter
      for(let i=0; i<16; i++) {
         const tex = pixiRenderer.textures[`sym_${Math.floor(Math.random()*8)}`];
         if (tex) {
            const s = new PIXI.Sprite(tex);
            s.anchor.set(0.5);
            s.y = i * (CELL_H * 0.85); // 嚙緙嚙盤嚙皺嚙踝蕭嚙複列
            s.width = CELL_W * 0.85; 
            s.height = CELL_H * 1.5;   // 嚙踝蕭嚙緲嚙諂迎蕭嚙編嚙緙嚙豎影
            s.alpha = 0.8;             // 嚙豎影嚙緲嚙踝蕭嚙踝蕭
            spinContainer.addChild(s);
         }
      }
      
      pixiRenderer.boardContainer.addChild(spinContainer);

      spinTicker = () => {
         const now = performance.now();
         const sysTime = now - globalStart;
         
         let speed = 45 * app.ticker.speed; // 嚙瑾嚙踝蕭t嚙踝蕭
         
         // 嚙磐嚙諉列嚙瞌嚙緩嚙箠嚙瘠嚙璀嚙畿嚙瘤嚙踝蕭[嚙緣嚙褕塚蕭嚙瘢嚙璀嚙篁嚙稼嚙緣
         if (isAnticipating && sysTime >= accTime) {
             speed = 100 * app.ticker.speed; // 嚙瞇嚙瞑嚙踝蕭嚙緣
             
             if (!highlighted) {
                 highlighted = true;
                 
                 // 嚙稼嚙緣嚙褕，嚙箠嚙瑾嚙畿嚙豎影嚙複，嚙踝蕭嚙諒選蕭 Shader
                 spinContainer.children.forEach(s => {
                     s.height = CELL_H * 2.8; 
                     s.alpha = 0.55; 
                     s.tint = 0xffeebb; // 嚙碾嚙磕嚙瑾嚙篁嚙踝蕭嚙踝蕭嚙踝蕭~
                 });
                 
                 for (let r = 0; r < ROWS; r++) {
                    const bg = pixiRenderer.bgSprites[r][c];
                    pixiRenderer._drawCellBg(bg, 'win'); // 嚙踝蕭嚙踝蕭I嚙踝蕭
                 }
             }
         }
         
         spinContainer.y += speed;
         // 嚙盤嚙稻嚙踝蕭嚙篌嚙瘦嚙踝蕭h 10 嚙諉符賂蕭嚙踝蕭嚙踝蕭嚙稿 (10 * 0.85 = 8.5)
         if (spinContainer.y > BOARD_H) spinContainer.y -= (CELL_H * 8.5);
      };
      app.ticker.add(spinTicker);
    }

    for (let r = 0; r < ROWS; r++) {
      const ct = sprites[r][c];
      promises.push(new Promise(resolve => {
        const dropStart = globalStart + delay;
        
        ct.scale.set(1);
        ct.alpha = 1;
        ct.filters = null;
        
        const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
        const ty = BOARD_PAD + r * (CELL_H + CELL_GAP) + CELL_H / 2;
        ct.position.set(tx, ty);
        
        const homeY = ty;
        ct.y = fromY;
        ct.alpha = 0;

        const tick = () => {
          const now = performance.now();
          if (now < dropStart) return;

          // 嚙諉列嚙線嚙踝蕭顫嚙踝蕭}嚙締嚙踝蕭嚙磊嚙褕，嚙瞎嚙踝蕭嚙踝蕭嚙踝蕭坋e嚙踝蕭
          if (spinTicker) {
             app.ticker.remove(spinTicker);
             spinTicker = null;
             if (spinContainer) {
                spinContainer.destroy();
                spinContainer = null;
             }
             if (highlighted) {
                 for (let row = 0; row < ROWS; row++) {
                     pixiRenderer._drawCellBg(pixiRenderer.bgSprites[row][c], 'normal');
                 }
             }
          }

          const elapsed = now - dropStart;
          const t = Math.min(elapsed / dur, 1);
          // 嚙踝蕭_嚙趣本嚙踝蕭嚙踝蕭嚙請反彈嚙瘦嚙瑾嚙趟掉嚙踝蕭嚙誕伐蕭 easeOutBack嚙璀嚙瞇嚙瞑嚙踝蕭嚙踝蕭嚙踝蕭 easeOutCubic
          const e = isAnticipating ? easeOutCubic(t) : easeOutBack(t);
          ct.alpha = Math.min(t * 3, 1);
          ct.scale.set(1); // 嚙確嚙瞌嚙磅嚙踝蕭嚙羯嚙踝蕭嚙踝蕭嚙踝蕭嚙踝蕭
          ct.y = fromY + (homeY - fromY) * e;

          if (t >= 1) { 
              ct.y = homeY; ct.alpha = 1; ct.scale.set(1); app.ticker.remove(tick); 

              // 嚙踝蕭顫嚙踝蕭u嚙踝蕭嚙踝蕭嚙磊嚙褕，嚙羯嚙踝蕭僄茼嚙踝蕭嚙踝蕭I嚙踝蕭嚙踝蕭嚙踝蕭 (Wild/Scatter)
              if (targetGrid && pixiRenderer) {
                 const cell = targetGrid[r][c];
                 const sym = SYMS[cell.symId];
                 const bg = pixiRenderer.bgSprites[r][c];
                 if (cell.wild) pixiRenderer._drawCellBg(bg, 'wild');
                 else if (sym?.isScatter) pixiRenderer._drawCellBg(bg, 'scatter');
              }
              
              if (onReelStop && !stoppedCols.has(c)) {
                  stoppedCols.add(c);
                  onReelStop(c);
              }
              resolve(); 
          }
        };
        app.ticker.add(tick);
      }));
    }
  }
  return Promise.all(promises);
}

// =====================================================
export class PixiRenderer {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    this.app = new PIXI.Application({
      width:           BOARD_W,
      height:          BOARD_H,
      backgroundColor: 0x0a0c1c,
      antialias:       true,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
    });
    canvasContainer.appendChild(this.app.view);

    this.textures        = {};
    this.sprites         = [];   // sprites[r][c]  - symbol containers
    this.bgSprites       = [];   // bgSprites[r][c] - cell backgrounds
    this.boardContainer  = null;
    this.particleLayer   = null;
    this._wildTickers    = [];   // cleanup handles for wild pulse animations
    this._winGlows       = [];   // active win glow handles

    // Responsive scaling
    this._setupResizeObserver();
  }

  // 嚙緩嚙緩 Responsive canvas scaling 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  _setupResizeObserver() {
    const resize = () => {
      const canvas = this.app.view;
      // 嚙緘嚙踝蕭嚙誹歹蕭嚙踝蕭i嚙諄空塚蕭 (嚙踝蕭嚙踝蕭嚙賤側200px嚙踝蕭嚙瞌嚙瞑gap嚙踝蕭嚙稽嚙緩)
      const sidePanelsW = 480; // 嚙賤側 panel + gap + padding
      const maxAvailable = Math.max(300, window.innerWidth - sidePanelsW);
      const scale = Math.min(1, maxAvailable / BOARD_W);
      
      canvas.style.width  = `${Math.round(BOARD_W * scale)}px`;
      canvas.style.height = `${Math.round(BOARD_H * scale)}px`;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  // 嚙緩嚙緩 Asset preload (native Image + PIXI.Texture.from) 嚙緩
  async preload() {
    const entries = [
      ...SYMS.map(s => ({ key: `sym_${s.id}`, url: s.img })),
      { key: 'wild', url: WILD_IMG },
    ];

    const loadOne = ({ key, url }) => new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try { this.textures[key] = PIXI.Texture.from(img); } catch (_) {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });

    await Promise.all(entries.map(loadOne));
    this._buildBoard();
    this._buildParticleLayer();

    // 嚙踝蕭嚙皚 Spine 嚙褊溫資源嚙稽嚙箴嚙踝蕭嚙畿嚙緲嚙璀嚙踝蕭嚙諸歹蕭嚙踝蕭嚙稻嚙瘠嚙踝蕭嚙課動）
    await this._loadSpineAssets();
  }

  // 嚙緩嚙緩 Build game board 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  _buildBoard() {
    this.boardContainer = new PIXI.Container();
    this.app.stage.addChild(this.boardContainer);

    // Board background
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0d0f22, 0.85);
    bg.lineStyle(2, COLOR.border, 0.7);
    bg.drawRoundedRect(0, 0, BOARD_W, BOARD_H, 18);
    bg.endFill();
    this.boardContainer.addChild(bg);

    // Subtle column dividers
    for (let c = 1; c < COLS; c++) {
      const x = BOARD_PAD + c * (CELL_W + CELL_GAP) - CELL_GAP / 2;
      const divider = new PIXI.Graphics();
      divider.beginFill(0xffffff, 0.025);
      divider.drawRect(x - 1, BOARD_PAD, 2, BOARD_H - BOARD_PAD * 2);
      divider.endFill();
      this.boardContainer.addChild(divider);
    }

    this.sprites   = [];
    this.bgSprites = [];

    for (let r = 0; r < ROWS; r++) {
      this.sprites[r]   = [];
      this.bgSprites[r] = [];
      for (let c = 0; c < COLS; c++) {
        const x = BOARD_PAD + c * (CELL_W + CELL_GAP);
        const y = BOARD_PAD + r * (CELL_H + CELL_GAP);

        // Cell background graphics
        const cellBg = new PIXI.Graphics();
        this._drawCellBg(cellBg, 'normal');
        cellBg.x = x;
        cellBg.y = y;
        this.boardContainer.addChild(cellBg);
        this.bgSprites[r][c] = cellBg;

        // Symbol container (pivot at center for scale/rotate animations)
        const cellCt = new PIXI.Container();
        cellCt.pivot.set(CELL_W / 2, CELL_H / 2);
        cellCt.position.set(x + CELL_W / 2, y + CELL_H / 2);
        this.boardContainer.addChild(cellCt);
        this.sprites[r][c] = cellCt;
      }
    }
    
  }

  _drawCellBg(g, type = 'normal') {
    g.clear();
    const styles = {
      wild:    { fill: 0x2a1400, a: 1, lc: COLOR.gold,   lw: 2, la: 0.9 },
      scatter: { fill: 0x080c1e, a: 1, lc: COLOR.cyan,   lw: 0, la: 0.0 }, // 嚙踝蕭嚙踝蕭嚙踝蕭嚙?      win:     { fill: 0x3a2600, a: 1, lc: COLOR.gold,   lw: 2, la: 1.0 },
      normal:  { fill: COLOR.cellBg, a: 1, lc: COLOR.border, lw: 1, la: 0.55 },
    };
    const s = styles[type] || styles.normal;
    g.beginFill(s.fill, s.a);
    if (s.lw > 0) g.lineStyle(s.lw, s.lc, s.la);
    g.drawRoundedRect(0, 0, CELL_W, CELL_H, 12);
    g.endFill();
  }

  _buildParticleLayer() {
    this.particleLayer = new PIXI.Container();
    this.app.stage.addChild(this.particleLayer);
  }

  // 嚙緩嚙緩 Spine 嚙赭源嚙踝蕭嚙皚 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
    async _loadSpineAssets() {
    this.spineData = {};
    this._spineLoaded = false;
    
    if (!window.PIXI || !window.PIXI.spine) {
      console.warn('[Spine] window.PIXI.spine not found (pixi-spine plugin missing), VFX disabled');
      return;
    }

    const spineCore = window.PIXI.spine.core || window.PIXI.spine;
    
    const BASE = 'assets/spine/';
    const toLoad = [
      { key: 'symbolVfx', atlas: BASE + 'Symbol_VFX.atlas', skel: BASE + 'Symbol_VFX.skel' },
      { key: 'binWinOmen', atlas: BASE + 'BinWin_Omen.atlas', skel: BASE + 'BinWin_Omen.skel' },
    ];

    try {
      for (const entry of toLoad) {
        // Fetch raw files
        const atlasText = await fetch(entry.atlas).then(r => r.text());
        const skelBin   = await fetch(entry.skel).then(r => r.arrayBuffer());

        // Parse Atlas
        const texLoader = new spineCore.TextureAtlas(atlasText, (path, loaderFunc) => {
          const tex = window.PIXI.Texture.from(BASE + path);
          loaderFunc(tex.baseTexture);
        });

        // Parse Binary
        const skelData = new spineCore.SkeletonBinary(new spineCore.AtlasAttachmentLoader(texLoader));
        skelData.scale = 1;
        const iData = skelData.readSkeletonData(new Uint8Array(skelBin));

        this.spineData[entry.key] = iData;
      }
      this._spineLoaded = true;
      console.log('[Spine] Assets loaded OK via manual fetch with pixi-spine. Keys:', Object.keys(this.spineData));
      
      // ── Ultimate Super-Bulletproof Patch for Pixi-Spine 3.8 + PixiJS v7 ──
      if (window.PIXI && window.PIXI.spine && window.PIXI.spine.Spine) {
        const SpineProto = window.PIXI.spine.Spine.prototype;
        if (!SpineProto.__patchedUltimateV2) {
          
          const crashGuard = function(origFn, name) {
            return function() {
              if (this.destroyed || !this.transform || !this.autoUpdateTransform) {
                return;
              }
              try {
                return origFn.apply(this, arguments);
              } catch (e) {
                if (e.message && (e.message.includes('transform') || e.message.includes('null'))) return;
                console.warn(`[SpineShield] ${name} suppressed:`, e);
              }
            };
          };

          if (SpineProto.autoUpdateTransform) {
            SpineProto.autoUpdateTransform = crashGuard(SpineProto.autoUpdateTransform, 'autoUpdateTransform');
          }
          if (SpineProto.updateTransform) {
            SpineProto.updateTransform = crashGuard(SpineProto.updateTransform, 'updateTransform');
          }
          if (SpineProto.containerUpdateTransform) {
            SpineProto.containerUpdateTransform = crashGuard(SpineProto.containerUpdateTransform, 'containerUpdateTransform');
          }
          if (SpineProto.render) {
            SpineProto.render = crashGuard(SpineProto.render, 'render');
          }

          SpineProto.__patchedUltimateV2 = true;
          console.log('%c[Spine] Ultimate 529 Shield V2 Active', 'color:#ff8800;font-weight:bold;');
        }
      }
    } catch (e) {
      console.warn('[Spine] Asset load failed, VFX disabled:', e);
    }
  }

  // Create Spine object
  _createSpine(key) {
    if (!this._spineLoaded || !this.spineData[key]) return null;
    try {
      const sd = this.spineData[key];
      const SpineObj = window.PIXI.spine.Spine;
      const sp = new SpineObj(sd);
      return sp;
    } catch (e) {
      console.warn('[Spine] createSpine failed:', key, e);
      return null;
    }
  }

  // 嚙緩嚙緩 Render single cell 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  renderCell(r, c, cellData) {
    const ct  = this.sprites[r][c];
    const bgG = this.bgSprites[r][c];

    // Clear previous contents
    while (ct.children.length > 0) ct.removeChild(ct.children[0]);
    ct.scale.set(1);
    ct.alpha = 1;
    ct.filters = null;

    // Reset to canonical grid position (fixes positioning drift)
    const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
    const ty = BOARD_PAD + r * (CELL_H + CELL_GAP) + CELL_H / 2;
    ct.position.set(tx, ty);

    if (!cellData) { this._drawCellBg(bgG, 'normal'); return; }

    const sym = SYMS[cellData.symId];

    // Cell background style
    if (cellData.wild)       this._drawCellBg(bgG, 'wild');
    else if (sym?.isScatter) this._drawCellBg(bgG, 'scatter');
    else                     this._drawCellBg(bgG, 'normal');

    const texKey = cellData.wild ? 'wild' : `sym_${cellData.symId}`;
    const tex    = this.textures[texKey];

    if (tex) {
      const isFullBleed = sym?.isScatter || cellData.symId === 8;
      // Scatter 嚙諍寸嚙碼嚙篌嚙豌伐蕭嚙踝蕭
      const size = sym?.isScatter ? CELL_W : (isFullBleed ? CELL_W - 6 : CELL_W - 22);
      const sprite = new PIXI.Sprite(tex);
      sprite.width  = size;
      sprite.height = size;
      sprite.anchor.set(0.5);
      sprite.x = CELL_W / 2;
      sprite.y = CELL_H / 2;

      // 嚙緘嚙瘦嚙瞌嚙踝蕭嚙踝蕭 Scatter嚙璀嚙誕伐蕭 ADD 嚙踝蕭 SCREEN 嚙諉過嚙緻嚙蝓抬蕭
      if (sym?.isGolden) {
        sprite.blendMode = PIXI.BLEND_MODES.SCREEN;
      }

      ct.addChild(sprite);
    } else {
      // Fallback text
      const label = new PIXI.Text(sym?.icon || '?', { fontSize: 38, fill: 0xffffff });
      label.anchor.set(0.5);
      label.x = CELL_W / 2;
      label.y = CELL_H / 2;
      ct.addChild(label);
    }



  }

  // 嚙緩嚙緩 Render full grid 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩


  // 嚙緩嚙緩 Render full grid 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  renderGrid(grid) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.renderCell(r, c, grid[r][c]);
  }

  // 嚙緩嚙緩 Spin start animation 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  async playSpinStart(newGrid, onReelStop = null) {
    const isBuyFeature = newGrid.isBuyFeature || false;
    const dur = spd(150);
    const all = this.sprites.flat();

    const anticipationCols = new Set();
    let consecutiveSc = 0;
    for (let c = 0; c < COLS; c++) {
      let hasScatter = false;
      for (let r = 0; r < ROWS; r++) {
         const sym = SYMS[newGrid[r][c]?.symId];
         if (sym?.isScatter) hasScatter = true;
      }
      if (hasScatter) consecutiveSc++;
      else break;
      
      if (consecutiveSc >= 3 && (c + 1) < COLS) {
        anticipationCols.add(c + 1);
      }
    }

    // Quick flash out
    await tween(this.app, {
      from: 1, to: 0.12, duration: dur, easing: easeInCubic,
      onUpdate: v => all.forEach(ct => ct.alpha = v),
    });

    this.renderGrid(newGrid);
    all.forEach(ct => { ct.alpha = 0; });
    
    // 嚙緩嚙踝蕭嚙罷嚙踝蕭G嚙箭嚙誶沒嚙踝蕭嚙磊嚙箴嚙璀嚙課佗蕭嚙瘢嚙踝蕭嚙諍喉蕭嚙篌嚙踝蕭^嚙請穿蕭 normal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
         this._drawCellBg(this.bgSprites[r][c], 'normal');
      }
    }

    let customDelays = null;
    let customAccelerateTimes = null;
    let dropDur = spd(300);
    
    // Override timings strictly for Buy Feature requirement
    if (isBuyFeature) {
      // 嚙踝蕭嚙踝蕭嚙課在嚙踝蕭嚙踝蕭C1, 2, 3 嚙踝蕭嚙諒序堆蕭嚙踝蕭C嚙踝蕭 4 嚙箭嚙箭嚙踝蕭 3 嚙箭嚙踝蕭嚙磊嚙褕加嚙緣嚙瘠嚙踝蕭 5 嚙箭嚙踝蕭嚙窯嚙踝蕭吽A嚙踝蕭嚙踝蕭 4 嚙箭嚙踝蕭嚙磊嚙踝蕭~嚙踝蕭嚙瘠
      customDelays = [
        800,            // Reel 1: drops at 0.8s 
        1800,           // Reel 2: drops at 1.8s (嚙踝蕭嚙篌 1.0s)
        2800,           // Reel 3: drops at 2.8s (嚙踝蕭嚙篌 1.0s)
        4500,           // Reel 4 (Near Win): drops at 4.5s (嚙踝蕭嚙瞇嚙瞑嚙稽 1.7s)
        5500            // Reel 5: drops at 5.5s (嚙踝蕭嚙篌 1.0s 嚙踝蕭嚙窯嚙踝蕭嚙磊)
      ];
      customAccelerateTimes = {
        3: 2800 // Reel 4 exactly synchronizes its acceleration with Reel 3's drop
      };
      
      // Force ONLY Reel 4 to trigger the visual anticipation effect
      anticipationCols.clear();
      anticipationCols.add(3); 
    }

    // Staggered column drop-in
    await staggeredDrop(this.app, this.sprites, -BOARD_H * 0.35, dropDur, anticipationCols, this, customDelays, customAccelerateTimes, newGrid, onReelStop);
  }

  // 嚙緩嚙緩 Win highlight animation 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  async playWinAnim(winCells) {
    const winSet = new Set(winCells.map(({ r, c }) => `${r}_${c}`));

    // Dim losers, highlight winners
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ct = this.sprites[r][c];
        if (winSet.has(`${r}_${c}`)) {
          ct.alpha = 1;
          this._drawCellBg(this.bgSprites[r][c], 'win');
          this._applyWinGlow(ct);
        } else {
          ct.alpha = 0.28;
        }
      }
    }

    // Win cells bounce
    const bouncePromises = winCells.map(({ r, c }) => {
      const ct = this.sprites[r][c];
      return tween(this.app, {
        from: 1, to: 1.12, duration: spd(180), easing: easeOutBack,
        onUpdate: v => ct.scale.set(v),
      }).then(() => tween(this.app, {
        from: 1.12, to: 1, duration: spd(160), easing: easeOutCubic,
        onUpdate: v => ct.scale.set(v),
      }));
    });

    await Promise.all(bouncePromises);
    await this._sleep(spd(350));

    // Restore
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.sprites[r][c].alpha = 1;
        this.sprites[r][c].scale.set(1);
        this._removeWinGlow(this.sprites[r][c]);
      }
    }
  }

  // 嚙緩嚙緩 Scatter breathe animation 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  async playScatterBreathe(cells) {
    // 嚙締嚙踝蕭 (Breathe in), 嚙綞嚙踢停頓 (Hold), 嚙磋嚙踝蕭嚙踝蕭 (Exhale/Impact)
    const promises = cells.map(({r, c}) => {
      const ct = this.sprites[r][c];
      
      return tween(this.app, {
        from: 1, to: 1.45, duration: 600, easing: easeOutCubic, // 嚙締嚙踝蕭
        onUpdate: v => ct.scale.set(v)
      }).then(() => tween(this.app, {
        from: 1.45, to: 1.5, duration: 400, easing: t => t, // 嚙綞嚙踝蕭L嚙盤嚙踝蕭嚙踝蕭
        onUpdate: v => ct.scale.set(v)
      })).then(() => tween(this.app, {
        from: 1.5, to: 0.95, duration: 250, easing: easeInCubic, // 嚙磋嚙踝蕭嚙踝蕭嚙踝蕭嚙磊嚙踝蕭嚙磐
        onUpdate: v => ct.scale.set(v)
      })).then(() => tween(this.app, {
        from: 0.95, to: 1, duration: 150, easing: easeOutCubic, // 嚙諒莎蕭穩嚙緩
        onUpdate: v => ct.scale.set(v)
      }));
    });
    
    // 嚙瞑嚙締嚙踝蕭亶嚙踝蕭p嚙褕連嚙褊閃嚙踝蕭嚙踝蕭
    this._sleep(800).then(() => {
        this.flashBoard(COLOR.gold, 3);
    });
    
    await Promise.all(promises);
  }

  _applyWinGlow(ct) {
    if (GlowFilter) {
      if (!ct._winGlow) {
        try {
          ct._winGlow = new GlowFilter({ distance: 18, outerStrength: 2.5, innerStrength: 0.5, color: COLOR.gold });
          ct.filters = (ct.filters || []).concat(ct._winGlow);
        } catch (_) {}
      }
    } else {
      // Fallback: ColorMatrix brightness pulse
      const cmf = new PIXI.ColorMatrixFilter();
      cmf.brightness(1.6, false);
      ct.filters = [cmf];
      ct._winGlow = cmf;
    }
  }

  _removeWinGlow(ct) {
    if (ct._winGlow) {
      ct.filters = (ct.filters || []).filter(f => f !== ct._winGlow);
      ct._winGlow = null;
    }
    if (!ct._pulseTicker) ct.filters = null;
  }

  // 嚙緩嚙緩 Eliminate animation 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  async playEliminateAnim(cells) {
    let spines = [];
    
    // 1. 先框住演火鍊
    if (this._spineLoaded && this.spineData['symbolVfx']) {
      spines = this._playSymbolVfx(cells);
      // 等待火鍊特效演出，營造「框住」的節奏感
      // 縮短等待時間（從 900 -> 600），並將保底降至 200ms，確保在極速下也能跟上 SYMBOL 爆掉的速度
      await this._sleep(Math.max(spd(600), 200));
    }

    // 2. symbol爆掉、演粒子噴發 (此時火鍊特效關掉)
    spines.forEach(sp => {
          try { 
            if (sp) {
              sp.visible = false;
              sp.renderable = false;
              sp.autoUpdate = false;
              
              try { sp.state.clearListeners(); } catch (_) {}
              try { if (PIXI.Ticker && PIXI.Ticker.shared) PIXI.Ticker.shared.remove(sp.update, sp); } catch (_) {}
              
              // Nuke update methods immediately
              sp.updateTransform = function() {};
              sp.autoUpdateTransform = function() {};
              sp.render = function() {};
              
              if (sp.parent) sp.parent.removeChild(sp);
              
              // Delayed physical destruction
              // 銷毀時間也改為 spd() 縮放，確保在極速模式下資源也能快速回收，不與下一次消除衝突
              this._sleep(spd(150)).then(() => {
                try { 
                  if (!sp.destroyed) sp.destroy({ children: true, texture: false, baseTexture: false }); 
                } catch(_) {}
              });
            }
          } catch(_) {}
    });

    const dur = spd(320);
    const promises = cells.map(({ r, c }) => {
      const ct = this.sprites[r][c];
      this._spawnBurst(ct.position.x, ct.position.y);
      return tween(this.app, {
        from: 1, to: 0, duration: dur, easing: easeInCubic,
        onUpdate: v => { ct.scale.set(v); ct.alpha = v; },
        onComplete: () => { ct.scale.set(1); ct.alpha = 0; },
      });
    });
    
    await Promise.all(promises);
    // 3. 乾淨的落下新的symbol (由外部呼叫 dropDown 接手)
  }

  // 播放 Spine Symbol_VFX 並回傳實例，供外部控制銷毀時機
  _playSymbolVfx(cells) {
    const spineInstances = [];
    if (!this._spineLoaded || !this.spineData['symbolVfx']) return spineInstances;

    const sd = this.spineData['symbolVfx'];
    const animName = (sd && sd.animations && sd.animations[0]) ? sd.animations[0].name : 'animation';

    for (const { r, c } of cells) {
      const sp = this._createSpine('symbolVfx');
      if (!sp) continue;
      // 計算格子中央（對齊方式依原本邏輯）
      const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
      const ty = BOARD_PAD + r * (CELL_H + CELL_GAP) + CELL_H / 2;
      sp.x = tx;
      sp.y = ty;
      
      // 強制拉滿至格子外圍，覆蓋整個正方形
      sp.width = CELL_W * 1.15;
      sp.height = CELL_H * 1.15;
      
      this.boardContainer.addChild(sp);
      try { sp.state.setAnimation(0, animName, false); } catch (_) {}
      spineInstances.push(sp);
    }

    return spineInstances;
  }

  // 嚙緩嚙緩 Drop-down animation (cascade refill) 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  async playDropDownAnim(grid) {
    this.renderGrid(grid);
    const sprites = this.sprites;
    const app     = this.app;
    const dur     = spd(280);
    await staggeredDrop(app, sprites, -BOARD_H * 0.35, dur, new Set(), this);
  }

  // 嚙緩嚙緩 Particle burst (on cell elimination) 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  _spawnBurst(wx, wy) {
    // 1. 嚙誰心踝蕭嚙踝蕭嚙箠 (Shockwave flash)
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffffff, 0.8);
    flash.drawCircle(0, 0, 18);
    flash.endFill();
    flash.x = wx; flash.y = wy;
    flash.blendMode = PIXI.BLEND_MODES.ADD;
    this.particleLayer.addChild(flash);

    tween(this.app, {
      from: 1, to: 0, duration: 250, easing: easeOutCubic,
      onUpdate: v => { flash.scale.set(1 + (1 - v) * 2.0); flash.alpha = v; },
      onComplete: () => flash.destroy()
    });

    // 2. 嚙諂殷蕭嚙踝蕭嚙瞑嚙踝蕭q嚙瘡嚙踝蕭 (Battle aura sparks & shards)
    const sparkCount = 20 + Math.random() * 12;
    const colors = [COLOR.gold, COLOR.cyan, COLOR.red, 0xffffff, 0xffffff];
    
    for (let i = 0; i < sparkCount; i++) {
      const g = new PIXI.Graphics();
      const isLine = Math.random() > 0.35;
      const c = colors[Math.floor(Math.random() * colors.length)];
      
      g.beginFill(c, 0.95);
      if (isLine) {
        // 嚙磊嚙瞋嚙諂迎蕭嚙踝蕭嚙豎影嚙踝蕭嚙踝蕭 (elongated spark)
        const w = 2 + Math.random() * 3.5;
        const h = 15 + Math.random() * 35;
        g.drawRect(-w/2, -h/2, w, h);
      } else {
        // 嚙磊嚙瞋嚙誶形碎嚙踝蕭 (sharp shard)
        const r = 4 + Math.random() * 7;
        g.drawPolygon([0, -r, r/2, 0, 0, r, -r/2, 0]);
      }
      g.endFill();
      
      g.blendMode = PIXI.BLEND_MODES.ADD;
      g.x = wx; g.y = wy;
      this.particleLayer.addChild(g);

      // 嚙蝓四嚙踝蕭嚙皺嚙踝蕭r嚙瞑嚙踝蕭嚙罷
      const angle = Math.random() * Math.PI * 2;
      g.rotation = angle + Math.PI / 2; // 嚙踝蕭嚙踝蕭嚙踝蕭嚙踝蕭V嚙畿嚙褊歹蕭V
      
      // 嚙緲嚙踝蕭嚙踝蕭t嚙踝蕭嚙踝蕭
      const spd2 = 300 + Math.random() * 450; 
      const vx = Math.cos(angle) * spd2;
      const vy = Math.sin(angle) * spd2;
      
      // 嚙諂堆蕭嚙磅嚙衝特嚙綞嚙瘦嚙線嚙瞑嚙畿嚙緲嚙緻嚙瞌嚙篌
      const life = 250 + Math.random() * 250;
      const born = performance.now();
      
      const tick = () => {
        const elapsed = performance.now() - born;
        const t = Math.min(elapsed / life, 1);
        const e = easeOutCubic(t); // 嚙誰速嚙衝出嚙踝蕭嚙皚嚙踝蕭t
        
        g.x = wx + vx * e * 0.45; // 嚙踝蕭嚙踝蕭戽嚙踝蕭X嚙踝蕭嚙範嚙踝蕭
        g.y = wy + vy * e * 0.45;
        g.scale.set(1 - t * 0.5); // 嚙瘡嚙諛殷蕭嚙踝蕭嚙豌莎蕭
        g.alpha = 1 - t;
        
        if (t >= 1) { this.app.ticker.remove(tick); g.destroy(); }
      };
      this.app.ticker.add(tick);
    }
  }

  // 嚙緩嚙緩 BigWin particle shower 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  spawnParticles(color = COLOR.gold) {
    const colors = typeof color === 'number' ? [color] : [COLOR.gold, COLOR.cyan];
    const cx     = BOARD_W / 2;

    for (let i = 0; i < 70; i++) {
      const g = new PIXI.Graphics();
      const c = colors[Math.floor(Math.random() * colors.length)];
      const r = 4 + Math.random() * 7;
      g.beginFill(c, 0.92);
      Math.random() > 0.5
        ? g.drawCircle(0, 0, r)
        : g.drawRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
      g.endFill();
      g.x = cx + (Math.random() - 0.5) * BOARD_W;
      g.y = BOARD_H + 10;
      this.app.stage.addChild(g);

      const vx   = (Math.random() - 0.5) * 350;
      const vy   = -(200 + Math.random() * 280);
      const life = 1200 + Math.random() * 800;
      const born = performance.now();
      const tick = () => {
        const t = Math.min((performance.now() - born) / life, 1);
        g.x += vx * 0.016;
        g.y += vy * 0.016 + 80 * 0.016 * t;
        g.alpha = 1 - Math.pow(t, 1.5);
        g.rotation += 0.05;
        if (t >= 1) { this.app.ticker.remove(tick); g.destroy(); }
      };
      this.app.ticker.add(tick);
    }
  }

  // 嚙緩嚙緩 Flash entire board (e.g. on jackpot) 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  flashBoard(color = 0xffffff, times = 3) {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(color, 0.45);
    overlay.drawRect(0, 0, BOARD_W, BOARD_H);
    overlay.endFill();
    this.app.stage.addChild(overlay);
    let count = 0;
    const period = 160;
    const born = performance.now();
    const tick = () => {
      const t = (performance.now() - born) % period / period;
      overlay.alpha = 0.45 * Math.sin(t * Math.PI);
      if (performance.now() - born > period * times * 2) {
        this.app.ticker.remove(tick);
        overlay.destroy();
      }
    };
    this.app.ticker.add(tick);
  }

  // 嚙緩嚙緩 Set board spinning state (blur effect) 嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  setBoardSpinning(on) {
    if (on) {
      if (!this.boardContainer._blurFilter) {
        const bf = new PIXI.BlurFilter(1.8);
        bf.quality = 6;
        bf.resolution = window.devicePixelRatio || 1;
        this.boardContainer._blurFilter = bf;
        this.boardContainer.filters = [bf];
      }
    } else {
      this.boardContainer.filters = null;
      this.boardContainer._blurFilter = null;
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // 嚙緩嚙緩 嚙踝蕭嚙箭嚙畿嚙篌嚙踝蕭嚙緩嚙踝蕭嚙稽BinWin Omen Spine 嚙踝蕭嚙衛對蕭嚙緣嚙碼嚙稷嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩嚙緩
  async playBinWinOmen() {
    if (!this._spineLoaded || !this.spineData['binWinOmen']) {
      this.flashBoard(0xff8800, 5);
      await this._sleep(spd(1200));
      return;
    }

    const sd = this.spineData['binWinOmen'];
    const animName = (sd && sd.animations && sd.animations[0]) ? sd.animations[0].name : 'animation';

    const globalCanvas = document.createElement('canvas');
    globalCanvas.style.position = 'fixed';
    globalCanvas.style.top = '0';
    globalCanvas.style.left = '0';
    globalCanvas.style.width = '100vw';
    globalCanvas.style.height = '100vh';
    globalCanvas.style.pointerEvents = 'none';
    globalCanvas.style.zIndex = '9999';
    document.body.appendChild(globalCanvas);

    const globalApp = new PIXI.Application({
      view: globalCanvas,
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: true,
    });

    let sp;
    try {
      sp = new PIXI.spine.Spine(sd);
      // Extra Instance-level Shield
      const shield = (fn) => function() { 
        if (this.destroyed || !this.transform) return; 
        try { return fn.apply(this, arguments); } catch(e) {}
      };
      sp.updateTransform = shield(sp.updateTransform);
      sp.autoUpdateTransform = shield(sp.autoUpdateTransform);
    } catch (e) {
      globalApp.destroy(true);
      globalCanvas.remove();
      return;
    }

    sp.x = window.innerWidth / 2;
    sp.y = window.innerHeight / 2;
    
    // 將倍率從原先的 1.5 調降，產生「推遠」的視覺效果，避免貼臉感
    const scaleRatio = Math.max(window.innerWidth, window.innerHeight) / 800 * 0.85;
    sp.scale.set(scaleRatio);
    globalApp.stage.addChild(sp);

    return new Promise(resolve => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        try { 
          // 1. Immediately Stop Ticker to prevent any more transform updates
          if (globalApp && globalApp.ticker) globalApp.ticker.stop();
          
          if (sp) {
             sp.visible = false;
             sp.renderable = false;
             
             // 2. Nuke methods
             sp.updateTransform = function() {};
             sp.autoUpdateTransform = function() {};
             sp.render = function() {};
             
             // 3. Detach from stage
             if (sp.parent) sp.parent.removeChild(sp);
          }
          
          // 4. Hide canvas instantly
          globalCanvas.style.display = 'none';
          
          // 5. Cleanup memory in next ticks
          setTimeout(() => {
            try { 
              if (sp && !sp.destroyed) sp.destroy({ children: true, texture: false, baseTexture: false }); 
            } catch (_) {}
            try { 
              // IMPORTANT: Do NOT destroy textures as they are shared with main renderer!
              globalApp.destroy(true, { children: true, texture: false, baseTexture: false }); 
            } catch (_) {}
            try { globalCanvas.remove(); } catch (_) {}
          }, 100);
          
          resolve(); 
        } catch (_) {
          resolve();
        }
      };

      const safety = setTimeout(done, 5000);

      try {
        sp.state.setAnimation(0, animName, false);
        sp.state.addListener({
          complete: () => { clearTimeout(safety); done(); }
        });
      } catch (e) {
        clearTimeout(safety);
        done();
      }
    });
  }

  // SoundManager stub
  playSound(_key) { /* TODO: connect sound system */ }
}