/** Bump when replacing logo files so browsers don't keep the old cached PNGs. */
export const GUS_ASSET_VERSION = '33'

/** Face/upper-body crop for small UI chips */
export const GUS_AVATAR_URL = `/gus-avatar.png?v=${GUS_ASSET_VERSION}`
export const GUS_LOGO_URL = `/gus-logo.png?v=${GUS_ASSET_VERSION}`

/** Distressed IRONMEDIC wordmark for the app header */
export const IRONMEDIC_WORDMARK_URL = `/ironmedic-wordmark-nav.png?v=${GUS_ASSET_VERSION}`

/** Rigged 3D Gus mesh + idle clip (full GLB). Extra clips load from GUS_ANIM_URLS. */
export const GUS_3D_URL = `/gus/gus-3d.glb?v=${GUS_ASSET_VERSION}`

/** Lightweight animation-only GLBs (bone tracks retargeted onto gus-3d by name). */
export const GUS_ANIM_URLS = {
  fold_arms: `/gus/anims/fold_arms.glb?v=${GUS_ASSET_VERSION}`,
  walk: `/gus/anims/walk.glb?v=${GUS_ASSET_VERSION}`,
} as const

/** Photoreal IronMedic shop backdrop (unused on dashboard; kept for possible reuse) */
export const GUS_SHOP_BG_URL = `/gus/ironmedic-shop.webp?v=${GUS_ASSET_VERSION}`
