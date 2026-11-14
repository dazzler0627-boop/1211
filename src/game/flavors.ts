import { CakeFlavor } from './types';

export const CAKE_FLAVORS: CakeFlavor[] = [
  {
    id: 'fraise',
    name: '草莓香緹',
    spongeTop: '#F7D9B4',
    spongeBottom: '#EBC294',
    filling: '#D94E5A',
    frosting: '#FFFBF5',
    frostingHighlight: '#FFFFFF',
    dripColor: '#E56B77',
    garnishColor: '#C93444',
    crumbColor: '#F3CCA0',
  },
  {
    id: 'matcha',
    name: '宇治抹茶',
    spongeTop: '#A6C48A',
    spongeBottom: '#8BAE6D',
    filling: '#6E473B',
    frosting: '#F4F8EC',
    frostingHighlight: '#FFFFFF',
    dripColor: '#7A9E5B',
    garnishColor: '#567A3B',
    crumbColor: '#9DBD7E',
  },
  {
    id: 'myrtille',
    name: '藍莓薰衣草',
    spongeTop: '#D4C3E8',
    spongeBottom: '#BFA7DB',
    filling: '#5E4B8B',
    frosting: '#FAF7FF',
    frostingHighlight: '#FFFFFF',
    dripColor: '#8B74B8',
    garnishColor: '#4B3A75',
    crumbColor: '#C8B4E0',
  },
  {
    id: 'caramel',
    name: '焦糖榛果',
    spongeTop: '#D9A773',
    spongeBottom: '#C18B54',
    filling: '#6B3F26',
    frosting: '#FFF4E4',
    frostingHighlight: '#FFFDF8',
    dripColor: '#C47A34',
    garnishColor: '#8C4E1F',
    crumbColor: '#CE965E',
  },
  {
    id: 'mangue',
    name: '黃金芒果',
    spongeTop: '#FCE09B',
    spongeBottom: '#F5C96B',
    filling: '#E8872B',
    frosting: '#FFFDF2',
    frostingHighlight: '#FFFFFF',
    dripColor: '#F2A93B',
    garnishColor: '#D96D1E',
    crumbColor: '#F7D27D',
  },
];

export function getFlavorForFloor(floorIndex: number): number {
  return Math.floor(floorIndex / 3) % CAKE_FLAVORS.length;
}
