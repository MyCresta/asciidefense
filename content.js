// Enemy stats are the base values before elapsed-time scaling.
export const ENEMIES = {
  crawler: {
    name: 'Crawler', tier: 1, trait: 'Swarm',
    description: 'A light ground unit that advances directly on the core.',
    hp: 7, speed: 1.65, damage: 8, reward: 3
  },
  moth: {
    name: 'Moth', tier: 1, trait: 'Rush',
    description: 'A fragile flier that bursts toward the spire.',
    hp: 5, speed: 2.75, damage: 5, reward: 2
  },
  wraith: {
    name: 'Wraith', tier: 2, trait: 'Phase surge',
    description: 'Surges forward in short bursts as it closes on the core.',
    hp: 12, speed: 1.85, damage: 10, reward: 4
  },
  brute: {
    name: 'Brute', tier: 2, trait: 'Plating',
    description: 'An armored ram that absorbs part of each hit.',
    hp: 23, speed: 1.05, damage: 18, reward: 6
  },
  splitter: {
    name: 'Splitter', tier: 2, trait: 'Brood',
    description: 'Releases two small crawlers when its shell breaks.',
    hp: 18, speed: 1.35, damage: 10, reward: 5
  },
  aegis: {
    name: 'Aegis', tier: 3, trait: 'Shield',
    description: 'Its shield recharges if it escapes fire long enough.',
    hp: 26, speed: 1.19, damage: 15, reward: 8
  },
  cantor: {
    name: 'Cantor', tier: 3, trait: 'Mending pulse',
    description: 'Emits a periodic pulse that heals nearby hostiles.',
    hp: 20, speed: 1.37, damage: 12, reward: 9
  },
  sovereign: {
    name: 'Sovereign', tier: 4, trait: 'Summon escort',
    description: 'Calls escorts every 17 seconds. Within 70 units, it also fires a siege bolt at the core.',
    hp: 165, speed: 0.88, damage: 42, reward: 40
  }
};

export const UPGRADES = {
  range: {
    name: 'Range', label: 'Range', group: 'arsenal',
    description: 'Engage targets farther from the spire.',
    icon: "   .-.   \n--( + )--\n   '-'   ",
    maxLevel: 10, baseCost: 10, growth: 1.48
  },
  rate: {
    name: 'Fire rate', label: 'Fire rate', group: 'arsenal',
    description: 'Fire more shots per second.',
    icon: '  // //\n // // \n// //  ',
    maxLevel: 10, baseCost: 14, growth: 1.48
  },
  splash: {
    name: 'Splash', label: 'Splash', group: 'arsenal',
    description: 'Hit hostiles around the primary target.',
    icon: '\\  |  /\n-- * --\n/  |  \\',
    maxLevel: 10, baseCost: 18, growth: 1.44
  },
  damage: {
    name: 'Impact', label: 'Impact', group: 'munitions',
    description: 'Increase the damage of each shot.',
    icon: '   /^\\\n==<##>\n   \\v/',
    maxLevel: 10, baseCost: 13, growth: 1.54
  },
  crit: {
    name: 'Critical hit', label: 'Crit chance', group: 'munitions',
    description: 'Raise the chance to deal critical damage.',
    icon: ' \\ ! /\n  [*] \n / ! \\',
    maxLevel: 8, baseCost: 17, growth: 1.53
  },
  chain: {
    name: 'Arc chain', label: 'Arc chain', group: 'munitions',
    description: 'Let shots arc between nearby targets.',
    icon: 'o-.    \n  \\.-o \n   \\.-o',
    maxLevel: 5, baseCost: 24, growth: 1.68
  },
  armor: {
    name: 'Armor', label: 'Armor', group: 'chassis',
    description: 'Reduce damage from every impact on the core.',
    icon: '.====.\n| /\\ |\n \\==/',
    maxLevel: 8, baseCost: 12, growth: 1.49
  },
  regen: {
    name: 'Repair', label: 'Repair', group: 'chassis',
    description: 'Regenerate core integrity over time.',
    icon: '  [+]  \n[+] [+]\n  [+]  ',
    maxLevel: 6, baseCost: 18, growth: 1.57
  },
  bounty: {
    name: 'Bounty', label: 'Bounty', group: 'chassis',
    description: 'Recover more scrap from destroyed hostiles.',
    icon: " .---.\n(  $  )\n '---'",
    maxLevel: 5, baseCost: 20, growth: 1.75
  }
};

export const POWERS = {
  twinshot: {
    name: 'Forked bolt', family: 'Ballistics', rare: true,
    description: 'Fire a second bolt at another target for 65% damage.',
    sigil: "      .==>\n====<     \n      '==>", maxStacks: 1
  },
  overclock: {
    name: 'Overclock', family: 'Ballistics',
    description: 'Increase fire rate by 25%.',
    sigil: '   / / /\n==/=/=/==\n / / /', maxStacks: 3
  },
  fracture: {
    name: 'Shatter lens', family: 'Ordnance',
    description: 'Add 10 units of blast radius to each shot.',
    sigil: '   \\ | /\n----(*)----\n   / | \\', maxStacks: 3
  },
  tesla: {
    name: 'Tesla winding', family: 'Ordnance',
    description: 'Shots arc to one more nearby target.',
    sigil: " o-.     o\n   \\   /\n    '-o'", maxStacks: 3
  },
  frost: {
    name: 'Cold snap', family: 'Control',
    description: 'Hits slow their target by 35% for 3 seconds.',
    sigil: ' \\  |  /\n--\\-*- /--\n  / | \\', maxStacks: 1
  },
  ember: {
    name: 'Cinder rounds', family: 'Ordnance',
    description: 'Direct hits burn for 60% extra damage over 3 seconds.',
    sigil: '   /).\n  /)( \\ \n  \\##/', maxStacks: 1
  },
  headhunter: {
    name: 'Kingslayer', family: 'Ballistics',
    description: 'Deal 60% more damage to tier III and IV enemies.',
    sigil: ' /V\\ /V\\\n |#####|\n----/----', maxStacks: 1
  },
  harvest: {
    name: 'Scrap magnet', family: 'Salvage',
    description: 'Collect 1 extra scrap for every kill.',
    sigil: ' ||   ||\n || $ ||\n  \\===/', maxStacks: 3
  },
  ward: {
    name: 'Phase ward', family: 'Defense', rare: true,
    description: 'Block a core impact. The ward recharges in 24 seconds.',
    sigil: "  .---.\n / [#] \\\n '.___.'", maxStacks: 1
  },
  repulse: {
    name: 'Repulsor', family: 'Control', rare: true,
    description: 'Every 10 seconds, push enemies in range outward by 10 units.',
    sigil: "  .-=-.\n<(  +  )>\n  '-=-'", maxStacks: 1
  },
  repair: {
    name: 'Siphon core', family: 'Defense',
    description: 'Restore 1 integrity for every 5 kills.',
    sigil: '  +   +\n   \\ /\n   [#]', maxStacks: 1
  },
  scope: {
    name: 'Long sight', family: 'Ballistics',
    description: 'Extend firing range by 12 units.',
    sigil: '    |    \n--((+))--\n    |    ', maxStacks: 3
  },
  reactor: {
    name: 'Hot core', family: 'Ballistics', reserve: true,
    description: 'Add 1 damage to every shot.',
    sigil: '  .---.\n ((#)) \n  -----', maxStacks: null
  },
  reservoir: {
    name: 'Reserve cell', family: 'Defense', reserve: true,
    description: 'Gain 12 maximum integrity and restore 12 integrity.',
    sigil: ' .----.\n |++++|\n [====]', maxStacks: null
  },
  interest: {
    name: 'Scrap dividend', family: 'Salvage', reserve: true,
    description: 'Gain 25 scrap, plus 5 per threat level.',
    sigil: '  /$ /\n /$ /$\n[=====]', maxStacks: null
  }
};

export const SYNERGIES = {
  rimewire: {
    name: 'Rimewire', power: 'frost', upgrade: 'chain', level: 2,
    description: 'Shots arc to one additional target.'
  },
  wildfire: {
    name: 'Wildfire', power: 'ember', upgrade: 'splash', level: 2,
    description: 'Blast hits also set their targets on fire.'
  },
  fieldmedic: {
    name: 'Blood bank', power: 'repair', upgrade: 'regen', level: 2,
    description: 'Siphon core restores 1 integrity every 3 kills.'
  }
};

export const DOCTRINES = {
  sentinel: {
    name: 'Sentinel', kills: 0, levels: {}, scrap: 0,
    description: 'Standard armament. Start with the full scrap reserve.'
  },
  ballista: {
    name: 'Ballista', kills: 40, levels: { damage: 2 }, scrap: -10,
    description: '+2 Impact levels. Start with 10 less scrap.'
  },
  conductor: {
    name: 'Conductor', kills: 125, levels: { chain: 1 }, scrap: -12,
    description: '+1 Arc chain level. Start with 12 less scrap.'
  },
  salvager: {
    name: 'Salvager', kills: 260, levels: { bounty: 2 }, scrap: -15,
    description: '+2 Bounty levels. Start with 15 less scrap.'
  }
};

// Keep the first five unlocks and thresholds compatible with existing records.
export const BLUEPRINTS = [
  { name: 'Salvage cache', kills: 20, description: 'Start each run with 10 extra scrap.' },
  { name: 'Tempered core', kills: 65, description: 'Deal 2 extra damage per shot.' },
  { name: 'Wideband optics', kills: 160, description: 'Start with a free range upgrade.' },
  { name: 'Fragment lens', kills: 340, description: 'Start with splash enabled.' },
  { name: 'Rapid relay', kills: 650, description: 'Start with a free fire rate upgrade.' }
];
