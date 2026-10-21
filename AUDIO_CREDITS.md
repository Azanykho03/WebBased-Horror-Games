# Escape the Haunting — background music, audio palette and optional recordings

## Supplied background music

| Use | Original filename under `public/assets/audio/` |
| --- | --- |
| Menu, settings/credits opened from the menu, and pre-game ready screen | `MELANCHOLIA Music Box Sad, creepy song.mp3` |
| House intro and gameplay, including caught/ending screens | `ILI ILI Tulog Anay Scary Version Music Box Cover.mp3` |

These are the user's existing recordings, copied once from Downloads because
this checkout contained neither file. Filenames and file bytes are unchanged;
no transcoding, trimming or replacement was performed. `MUSIC_AUDIO` in
`src/config.ts` registers them for both development and production builds.

One streaming audio element loops the current recording through the existing
music bus, contextual ducking and master volume. A track change fades out for
0.8 seconds, switches the source at silence, then fades the next recording in
for 0.8 seconds after playback starts. The recordings never overlap. A first
click, tap or key press enables audio; later interactions retry browser-blocked
playback. Pause/backgrounding freezes the track and resumes at its position.

## Supplied Celestina layers and cues

The following five MP3s were supplied by the user from Downloads and copied
byte-for-byte into `public/assets/audio/`. `CORAZON_AUDIO` in `src/config.ts`
registers their paths, loop behavior, volumes, fades and proximity thresholds.
They use the existing Web Audio context and mixer; source files are unchanged.

| Recording | Use | Mixer control |
| --- | --- | --- |
| `CreepyNightBreeze.mp3` | Loops with MELANCHOLIA on pre-game screens; fades out on entry | Music |
| `CreepyLittleGirl.mp3` | Loops with the existing ILI ILI / Mixkit gameplay bed | Ambience |
| `CreepyCurseSound.mp3` | Single proximity loop, 8 m entry / 11 m exit | Effects |
| `peircing.wavJumpscare.mp3` | One-shot from the 0.20 s impact on Celestina's close face reveal; stops with the sequence | Effects |
| `scaryjumpscaregrabbinglegs.mp3` | One-shot on initial leg contact, alongside the stumble and camera impact; stops on release, failure or interruption | Effects |

Creator, source URL and license metadata were not supplied for these files;
none is inferred from their names.

## Original effects and optional dialogue

The shipped ambience, adaptive tension cues, weather, footsteps, heartbeat, breathing,
interaction effects and supernatural textures are original Web Audio synthesis
in `src/audio.ts`. These effects remain alongside the two recordings and require
no audio downloads. No external audio library has been added.

Celestina's airy vocal textures are **synthesized placeholders, not spoken English**.
The lines are readable as subtitles. The playable game does not require recordings,
but a fully voiced release needs the clips below. Empty configuration entries do
not request missing files. Do not create empty `.wav` files as substitutes.

## Recording manifest

Suggested location: `public/assets/audio/corazon/`. Register actual files in
`VOICE_AUDIO` in `src/config.ts`; paths start with `audio/`, relative to
`public/assets/`. Mono WAV or browser-supported Ogg is suitable for spatial voices.
Keep recordings dry; the mixer supplies distance, wall filtering and reverb.
Use comparable perceived levels and leave headroom. Avoid embedding a jump in
loudness in the recording; the mixer supplies the scare impact separately.

| Cue | Suggested filename | Content |
| --- | --- | --- |
| `whisper-1` | `whisper_01.wav` | Turn around. |
| `whisper-2` | `whisper_02.wav` | I can hear you breathing. |
| `whisper-3` | `whisper_03.wav` | I am closer than you think. |
| `whisper-4` | `whisper_04.wav` | I see you. |
| `whisper-5` | `whisper_05.wav` | You should never have come here. |
| `whisper-6` | `whisper_06.wav` | This house remembers you. |
| `whisper-7` | `whisper_07.wav` | Do not look behind you. |
| `whisper-8` | `whisper_08.wav` | I have been waiting for you. |
| `kitchen-player` | `kitchen_player.wav` | Something is in here. |
| `kitchen-ghost` | Caption only during impact | Pool in `GHOST_DIALOGUE`; no voice layered over the scare |
| `recognition` | `recognition.wav` | I need to get out. |
| `spotted` | `spotted.wav` | I see you. |
| `sprint` | `sprint.wav` | Don't run from me. |
| `lost` | `lost.wav` | I can hear you breathing. |
| `exit` | `exit.wav` | You belong to this house now. |
| `hit` | `hit.wav` | You cannot stop me. |
| `capture` | Caption only during impact | Pool in `GHOST_DIALOGUE`; no second scare sound |
| `cry`, `hum`, `laugh`, `scream` | `cry.wav`, `hum.wav`, `laugh.wav`, `scream.wav` | Short performed vocalizations, no copied character performance |

For clips with no profanity, set both `normal` and `clean` to the same file.
Clean mode deliberately never falls back to an unclean recording. New configured
recordings are copied into the production build by the existing Vite asset plugin.
Record with a consenting performer; retain the recording and redistribution terms.

```ts
// Example only; enable after the file exists.
'whisper-1': {
  normal: 'audio/corazon/whisper_01.wav',
  clean: 'audio/corazon/whisper_01.wav',
}
```

## Optional source searches

The procedural effects are complete. These are optional replacement sources,
not dependencies or assets already licensed for this project. Specific English
lines are best recorded for the game. Verified source pages on 2026-10-02:

| Category | Source and suggested search |
| --- | --- |
| Nonverbal whisper, cry, breath, cloth | [Freesound](https://freesound.org/help/faq/#licenses): `female whisper CC0`, `quiet sobbing CC0`, `cloth movement CC0` |
| Rain, roof, wind and thunder | [Freesound](https://freesound.org/help/faq/#licenses): `rain roof seamless CC0`, `distant thunder CC0`, `wind window CC0` |
| Creaks, footsteps, doors, window, object fall | [Sonniss GameAudioGDC](https://sonniss.com/gameaudiogdc/): `old wooden house creak`, `wood floor footsteps`, `window rattle`, `cabinet latch` |
| Pickup and menu sounds | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds): `interface select`, `item pickup` |
| Alternate musical textures | [Freesound](https://freesound.org/help/faq/#licenses): `dark drone CC0`, `bowed metal texture CC0`; layer original phrases rather than a copied soundtrack |

Freesound licenses vary by upload; check the individual page and prefer CC0.
Kenney's linked pack lists CC0. Sonniss supplies its own game-audio license;
check the bundle license, especially its restriction on standalone redistribution.
None of these sites' files were downloaded or included in this change.

## External asset credit ledger

The two background tracks above were supplied by the user as local MP3s. Creator,
source URL and license metadata were not supplied; no attribution or license is
inferred from the filenames. Both files are included without modification.

For each future recording or licensed sound, record the exact
filename, original title, creator, source URL, license/version, modifications,
required attribution, and performer permission where relevant. Preserve a copy
of its license with the source asset. Existing model provenance stays with the
models; this document covers audio only.
