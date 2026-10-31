const BASE = '/assets/lake-ulysses/sprites/';

export const ANIMS = {
  lake_bg:   { base: `${BASE}spr_lake_bg_001/spr_lake_bg_001_`, frames: 46, fps: 12 },
  quote_bg:  { base: `${BASE}spr_QuoteBG/spr_QuoteBG_`,        frames: 5,  fps: 6  },
  bob_baiter:{ base: `${BASE}spr_bb/spr_bb_`,                  frames: 10, fps: 8  },
  // The artist's stop-motion loops (Drive: TheLake.gif, stairsmove.gif, 270x480,
  // 12 fps), full-screen behind walk narration; they win over the code-drawn loops.
  loop_lake:   { base: `${BASE}loop_lake/loop_lake_`,     frames: 9,  fps: 12 },
  loop_stairs: { base: `${BASE}loop_stairs/loop_stairs_`, frames: 12, fps: 12 },
  // Bob Baiter's announcement symbols, from the GameMaker beta
  // (obj_intro_dialog_symbols) — imported by scripts/import-gm-symbols.mjs.
  sym_biohazard: { base: `${BASE}spr_biohazard/spr_biohazard_`,   frames: 31, fps: 12 },
  sym_pets:      { base: `${BASE}spr_pet_symbol/spr_pet_symbol_`, frames: 31, fps: 12 },
  sym_exposure:  { base: `${BASE}spr_exposure/spr_exposure_`,     frames: 31, fps: 12 },
  sym_fish:      { base: `${BASE}spr_fish/spr_fish_`,             frames: 32, fps: 12 },
  sym_baitshop:  { base: `${BASE}spr_baitshop/spr_baitshop_`,     frames: 19, fps: 12 },
};
