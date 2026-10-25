/**
 * Photographs on the public pages and where they come from. The studio set
 * was generated for Resoniq; the players set is public domain (CC0) via
 * rawpixel, found through Openverse. CC0 needs no attribution; it's given
 * anyway, with links, on /credits.
 */
export type PhotoCredit = { file: string; subject: string; license: string; source: string; href?: string };

export const PHOTO_CREDITS: PhotoCredit[] = [
  { file: "studio-guitar", subject: "Guitar, amplifier and pedals in a studio", license: "Generated for Resoniq", source: "Resoniq" },
  { file: "studio-bassist", subject: "Bassist beside a studio rig", license: "Generated for Resoniq", source: "Resoniq" },
  { file: "studio-pedals", subject: "Pedalboard with overdrive, delay and compressor", license: "Generated for Resoniq", source: "Resoniq" },
  { file: "musicians/drums-stage", subject: "Drum kit on a lit stage", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/5922324/photo-image-public-domain-shadow-free" },
  { file: "musicians/bass-sunburst", subject: "Sunburst bass guitar", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/6036245/photo-image-background-public-domain-free" },
  { file: "musicians/live-red", subject: "Guitarist on stage in red light", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/3337444/free-photo-image-music-concert-video-band" },
  { file: "musicians/producer-console", subject: "Hands on a mixing console", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/5911953/image-public-domain-person-free" },
  { file: "musicians/piano-hands", subject: "Hands on piano keys", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/5945480/free-public-domain-cc0-photo" },
  { file: "musicians/pedalboard-stage", subject: "Pedalboard at a guitarist's feet", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/5943380/free-public-domain-cc0-photo" },
  { file: "musicians/vocal-mic", subject: "Vintage microphone", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/5907470/photo-image-public-domain-shape-vintage" },
  { file: "musicians/home-studio", subject: "Home recording studio", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/3338813/free-photo-image-audio-speaker-cc0-creative-commons" },
  { file: "musicians/crowd-lights", subject: "Crowd under stage lights", license: "CC0 1.0", source: "rawpixel", href: "https://www.rawpixel.com/image/3294002/free-photo-image-stage-light-concert-png-advertisement" },
];
