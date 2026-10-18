export interface Palette {
  ground: number;
  forest: number;
  meadow: number;
  field: number;
  water: number;
  tree: number;
  shade: number;
  road: number;
  edge: number;
  line: number;
  tracks: number;
  dust: number;
  conifers: boolean;
  text: string;
  stroke: string;
}

export const PALETTES: Record<string, Palette> = {
  asphalt: {
    ground: 0x2a4223,
    forest: 0x1d3818,
    meadow: 0x4d6b32,
    field: 0x76703f,
    water: 0x2f6f9e,
    tree: 0x214a1b,
    shade: 0x0f220c,
    road: 0x5b5f66,
    edge: 0x2b2e33,
    line: 0xe6e6e6,
    tracks: 0x3f4247,
    dust: 0xb0b0b0,
    conifers: false,
    text: '#ffffff',
    stroke: '#111611',
  },
  gravel: {
    ground: 0x3d3622,
    forest: 0x2b3b1c,
    meadow: 0x5e5a33,
    field: 0x7d6a45,
    water: 0x2f6a8c,
    tree: 0x2d4a22,
    shade: 0x172610,
    road: 0xa38b5c,
    edge: 0x5c4c31,
    line: 0xa38b5c,
    tracks: 0x7a6440,
    dust: 0xc8b088,
    conifers: false,
    text: '#ffffff',
    stroke: '#1d1810',
  },
  snow: {
    ground: 0xdde6ec,
    forest: 0xc9d6de,
    meadow: 0xf3f7fa,
    field: 0xe6edf2,
    water: 0x7fa6c0,
    tree: 0x24463a,
    shade: 0x9fb0bb,
    road: 0xa9b5bd,
    edge: 0x6f7f8a,
    line: 0xf3f7fa,
    tracks: 0x7f8f9a,
    dust: 0xffffff,
    conifers: true,
    text: '#1b1f24',
    stroke: '#ffffff',
  },
};
