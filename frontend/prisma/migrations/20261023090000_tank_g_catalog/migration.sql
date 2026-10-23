-- M-VAVE TANK-G catalog entry for the device preset library (lib/devices/tank-g.ts).
-- Data-only and idempotent: an existing row with this slug is left untouched.
INSERT INTO "GearItem" ("id", "slug", "kind", "brand", "model", "description", "controls", "status", "createdAt")
VALUES (
  'gear_m_vave_tank_g', 'm-vave-tank-g', 'MULTIFX', 'M-VAVE', 'TANK-G',
  'Rechargeable multi-effects pedal: noise gate, 9 amp slots with a 3-band tone stack, chorus/phaser/tremolo, 3 delays, 3 reverbs, 8 IR slots and 36 presets.',
  ARRAY['NOISE GATE','TYPE','GAIN','TREBLE','MIDDLE','BASS','VOLUME','MOD FX','MOD SPEED','DLY MIX','DLY TIME','RVB DECAY','RVB MIX','IR CAB','MASTER'],
  'APPROVED', CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
