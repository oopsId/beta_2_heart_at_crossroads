# Audio reconciliation

Stage 2C keeps story JSON audio cues intact and restores missing music names as conservative aliases to existing tracks already shipped with the project. These aliases are temporary substitutes: if an original source track is recovered later, replace the alias file without changing story data.

Music aliases:
- `ending_song_white.mp3` -> `bgm_quiet_reflection.mp3`
- `bgm_upbeat_friendship.mp3` -> `bgm_morning_after.mp3`
- `bgm_mystery_reveal.mp3` -> `bgm_tension_rise.mp3`
- `bgm_fleeting_moment.mp3` -> `bgm_evening_dusk.mp3`
- `bgm_betrayal_tune.mp3` -> `bgm_melancholy_moment.mp3`
- `bgm_secret_revealed.mp3` -> `bgm_corporate_tension.mp3`
- `bgm_crossroads_heart.mp3` -> `bgm_final_choice.mp3`

Unresolved SFX are intentionally not replaced with unrelated noises. Current unique missing SFX names:
`sfx_coffee_shop_ambient.mp3`, `sfx_office_night_ambient.mp3`, `sfx_footsteps_sneakers.mp3`, `sfx_style1_ambient.mp3`, `sfx_footsteps_highheels.mp3`, `sfx_excited_laugh.mp3`, `sfx_disappointed_sigh.mp3`, `sfx_quiet_whisper.mp3`, `sfx_phone_pocket.mp3`, `sfx_collision_drop.mp3`, `sfx_awkward_silence.mp3`, `sfx_nervous_laugh.mp3`, `sfx_confident_step.mp3`, `sfx_worried_gasp.mp3`, `sfx_subtle_chuckle.mp3`, `sfx_club_music_fade.mp3`, `sfx_club_chatter.mp3`, `sfx_club_beat_drop.mp3`, `sfx_club_fade_out.mp3`, `sfx_club_ambient_shift.mp3`, `sfx_subtle_sigh.mp3`, `sfx_heartfelt_moment.mp3`, `sfx_dramatic_pause.mp3`, `sfx_tearful_breath.mp3`, `sfx_comforting_tone.mp3`, `sfx_style1_ambient_day.mp3`, `sfx_heart_beat_fast.mp3`, `sfx_excited_clap.mp3`.
