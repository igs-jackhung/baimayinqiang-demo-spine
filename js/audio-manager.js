/**
 * AudioManager.js
 * Centralized audio management using Howler.js
 */

export class AudioManagerClass {
  constructor() {
    this.bgm = null;
    this.bgmId = null;
    this.muted = false;
    this.initialized = false;
    
    // Fallback durations in seconds based on file analysis
    this.fallbackDurations = {
      BIG_WIN: 9,
      MEGA_WIN: 11,
      SUPER_WIN: 13,
      LEGENDARY_WIN: 15
    };
    
    this.config = {
      bgm: {
        MG: 'assets/audio/bgm/MG_BGM.mp3',
        FG: 'assets/audio/bgm/FG_BGM.mp3',
        BIG_WIN: 'assets/audio/bgm/Big_Win.mp3',
        SETTLEMENT: 'assets/audio/bgm/FG_Compliment.mp3'
      },
      sfx: {
        SPIN_START: 'assets/audio/sfx/Reel_Run.mp3',
        SPIN_STOP: 'assets/audio/sfx/Reel_Stop.mp3',
        SCATTER_LAND: 'assets/audio/sfx/Scatter.mp3',
        SCATTER_WIN: 'assets/audio/sfx/Scatter_Win.mp3',
        SYMBOL_WIN: 'assets/audio/sfx/Symbol_Win.mp3',
        ELIMINATE: 'assets/audio/sfx/Symbol_Boom.mp3',
        MULTIPLY_FLY: 'assets/audio/sfx/Multiply_Fly.mp3',
        MULTIPLY_END: 'assets/audio/sfx/Multiply_End.mp3',
        FG_MULTIPLY_UP: 'assets/audio/sfx/FG_Multiply_Up.mp3',
        FG_TRIGGER: 'assets/audio/sfx/FG_in.mp3',
        FG_ADD: 'assets/audio/sfx/FG_Add.mp3',
        TRANSITION: 'assets/audio/sfx/FG_Transitions.mp3',
        OMEN: 'assets/audio/sfx/Bigwin_Omen.mp3',
        
        NEAR_WIN: 'assets/audio/sfx/NearWin.mp3',
        SCATTER_RING: 'assets/audio/sfx/ScatterRing.mp3',
        BIG_WIN_END: 'assets/audio/sfx/Big_Win_end.mp3',
        MEGA_WIN: 'assets/audio/sfx/Mega_win.mp3',
        MEGA_WIN_END: 'assets/audio/sfx/Mega_win_end.mp3',
        SUPER_WIN: 'assets/audio/sfx/Super_Win.mp3',
        SUPER_WIN_END: 'assets/audio/sfx/Super_Win_end.mp3',
        LEGENDARY_WIN: 'assets/audio/sfx/Legendary_win.mp3',
        LEGENDARY_WIN_END: 'assets/audio/sfx/Legendary_win_end.mp3'
      },
      vo: {
        SYM_WIN_VO: 'assets/audio/vo/Symbol_Win_Voice_4.mp3',
        FG_IN_VO: 'assets/audio/vo/FG_In_Voice_3.mp3'
      }
    };
    
    this.sounds = {};
  }

  /**
   * Must be called after user interaction to enable audio on most browsers.
   */
  init() {
    if (this.initialized) return;
    
    // Preload sounds
    Object.entries(this.config.sfx).forEach(([id, path]) => {
      this.sounds[id] = new Howl({ src: [path], volume: 0.6 });
    });
    
    Object.entries(this.config.vo).forEach(([id, path]) => {
      const vol = (id === 'FG_IN_VO') ? 0.4 : 1.0;
      this.sounds[id] = new Howl({ src: [path], volume: vol });
    });

    this.initialized = true;
    console.log('[AudioManager] Initialized');
  }

  playBGM(mode, loop = true, onEnd = null) {
    if (!this.initialized) return;
    const path = this.config.bgm[mode];
    if (!path) return;

    if (this.bgm) {
      if (this.bgmId === mode) return; // Already playing
      this.bgm.fade(this.bgm.volume(), 0, 1000);
      const oldBgm = this.bgm;
      setTimeout(() => oldBgm.stop(), 1000);
    }

    this.bgm = new Howl({
      src: [path],
      loop: loop,
      volume: 0,
      html5: true // Use HTML5 audio for long tracks
    });
    
    if (onEnd) this.bgm.once('end', onEnd);

    this.bgmId = mode;
    this.bgm.play();
    this.bgm.fade(0, 0.7, 1000);
  }

  stopBGM() {
    if (this.bgm) {
      this.bgm.fade(this.bgm.volume(), 0, 500);
      setTimeout(() => {
        this.bgm.stop();
        this.bgm = null;
        this.bgmId = null;
      }, 500);
    }
  }

  playSFX(id, loop = false, onEnd = null) {
    if (!this.initialized) return;
    const sound = this.sounds[id];
    if (sound) {
      sound.loop(loop);
      if (onEnd) sound.once('end', onEnd);
      sound.play();
    } else {
      console.warn(`[AudioManager] SFX not found: ${id}`);
    }
  }

  stopSFX(id) {
    if (!this.initialized) return;
    const sound = this.sounds[id];
    if (sound) {
      sound.stop();
    }
  }

  playVO(id) {
    if (!this.initialized) return;
    const sound = this.sounds[id];
    if (sound) {
      sound.play();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    return this.muted;
  }

  /**
   * Check if a specific sound or BGM is currently playing.
   */
  isPlaying(id) {
    if (!this.initialized) return false;
    const sound = this.sounds[id] || (this.bgmId === id ? this.bgm : null);
    return sound ? sound.playing() : false;
  }

  /**
   * Get the duration of a sound in seconds.
   */
  getDuration(id) {
    if (!this.initialized) return this.fallbackDurations[id] || 0;
    const sound = this.sounds[id] || (this.bgmId === id ? this.bgm : null);
    let dur = sound ? sound.duration() : 0;
    
    // If duration is 0 (not loaded) or not found, use fallback
    if (dur === 0) {
      dur = this.fallbackDurations[id] || 0;
    }
    return dur;
  }
}

export const AudioManager = new AudioManagerClass();
