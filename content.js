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
    name: 'Forked bolt', family: 'Ballistics', rarity: 'rare', rare: true,
    description: 'Fire a second bolt at another target for 65% damage.',
    sigil: "      .==>\n====<     \n      '==>", maxStacks: 1
  },
  overclock: {
    name: 'Overclock', family: 'Ballistics', rarity: 'common',
    description: 'Increase fire rate by 25%.',
    sigil: '   / / /\n==/=/=/==\n / / /', maxStacks: 3
  },
  fracture: {
    name: 'Shatter lens', family: 'Ordnance', rarity: 'common',
    description: 'Add 10 units of blast radius to each shot.',
    sigil: '   \\ | /\n----(*)----\n   / | \\', maxStacks: 3
  },
  tesla: {
    name: 'Tesla winding', family: 'Ordnance', rarity: 'common',
    description: 'Shots arc to one more nearby target.',
    sigil: " o-.     o\n   \\   /\n    '-o'", maxStacks: 3
  },
  frost: {
    name: 'Cold snap', family: 'Control', rarity: 'common',
    description: 'Hits slow their target by 35% for 3 seconds.',
    sigil: ' \\  |  /\n--\\-*- /--\n  / | \\', maxStacks: 1
  },
  ember: {
    name: 'Cinder rounds', family: 'Ordnance', rarity: 'common',
    description: 'Direct hits burn for 60% extra damage over 3 seconds.',
    sigil: '   /).\n  /)( \\ \n  \\##/', maxStacks: 1
  },
  headhunter: {
    name: 'Kingslayer', family: 'Ballistics', rarity: 'common',
    description: 'Deal 60% more damage to tier III and IV enemies.',
    sigil: ' /V\\ /V\\\n |#####|\n----/----', maxStacks: 1
  },
  harvest: {
    name: 'Scrap magnet', family: 'Salvage', rarity: 'common',
    description: 'Collect 1 extra scrap for every kill.',
    sigil: ' ||   ||\n || $ ||\n  \\===/', maxStacks: 3
  },
  ward: {
    name: 'Phase ward', family: 'Defense', rarity: 'rare', rare: true,
    description: 'Block a core impact. The ward recharges in 24 seconds.',
    sigil: "  .---.\n / [#] \\\n '.___.'", maxStacks: 1
  },
  repulse: {
    name: 'Repulsor', family: 'Control', rarity: 'rare', rare: true,
    description: 'Every 10 seconds, push enemies in range outward by 10 units.',
    sigil: "  .-=-.\n<(  +  )>\n  '-=-'", maxStacks: 1
  },
  repair: {
    name: 'Siphon core', family: 'Defense', rarity: 'common',
    description: 'Restore 1 integrity for every 5 kills.',
    sigil: '  +   +\n   \\ /\n   [#]', maxStacks: 1
  },
  scope: {
    name: 'Long sight', family: 'Ballistics', rarity: 'common',
    description: 'Extend firing range by 12 units.',
    sigil: '    |    \n--((+))--\n    |    ', maxStacks: 3
  },
  reactor: {
    name: 'Hot core', family: 'Ballistics', rarity: 'reserve', reserve: true,
    description: 'Add 1 damage to every shot.',
    sigil: '  .---.\n ((#)) \n  -----', maxStacks: null
  },
  reservoir: {
    name: 'Reserve cell', family: 'Defense', rarity: 'reserve', reserve: true,
    description: 'Gain 12 maximum integrity and restore 12 integrity.',
    sigil: ' .----.\n |++++|\n [====]', maxStacks: null
  },
  interest: {
    name: 'Scrap dividend', family: 'Salvage', rarity: 'reserve', reserve: true,
    description: 'Gain 25 scrap, plus 5 per threat level.',
    sigil: '  /$ /\n /$ /$\n[=====]', maxStacks: null
  },
  caliper: {
    name: 'Ratchet sight', family: 'Ballistics', rarity: 'common',
    description: "Gain 8 percentage points of critical chance.",
    sigil: " o-|-o\n   |\n  [_]", maxStacks: 2
  },
  longshot: {
    name: 'Rangefinder', family: 'Ballistics', rarity: 'common',
    description: "Deal 30% more damage beyond 32 units.",
    sigil: " .-----o\n | .---+\n |/", maxStacks: 1
  },
  buckshot: {
    name: 'Breech choke', family: 'Ordnance', rarity: 'common',
    description: "Deal 35% more damage inside 18 units.",
    sigil: "  _/o\n==< o O\n  \\_o", maxStacks: 1
  },
  clockwork: {
    name: 'Flywheel', family: 'Ballistics', rarity: 'common',
    description: "Fire 45% faster during the first 3 seconds of each 12-second cycle.",
    sigil: " .-12-.\n9  |  3\n '-6-'", maxStacks: 1
  },
  firstblood: {
    name: 'Glass cutter', family: 'Ordnance', rarity: 'common',
    description: "Direct hits deal 45% more damage to a full-health target.",
    sigil: " .--.  /\n |<>| /\n '--'/", maxStacks: 1
  },
  spotter: {
    name: 'Marking iron', family: 'Ballistics', rarity: 'common',
    description: "Deal 35% more damage to the target you have focused.",
    sigil: "  |\n-[o]-\n  |", maxStacks: 1
  },
  foundry: {
    name: 'Foundry die', family: 'Salvage', rarity: 'common',
    description: "All foundry prices fall by 8%.",
    sigil: "  ___\n /: /|\n|__|/", maxStacks: 2
  },
  bulwark: {
    name: 'Rivet plate', family: 'Defense', rarity: 'common',
    description: "Gain 2 armor against every core impact.",
    sigil: "+---+\n|#:#|\n+---+", maxStacks: 3
  },
  triage: {
    name: 'Triage pump', family: 'Defense', rarity: 'common',
    description: "Recover 0.7 extra integrity per second below half health.",
    sigil: "  |+|\n--| |--\n _|_|_", maxStacks: 2
  },
  stipend: {
    name: 'Mint wheel', family: 'Salvage', rarity: 'common',
    description: "Gain 5 scrap every 20 seconds.",
    sigil: "  __\n /$ /\n(===)", maxStacks: 3
  },
  poacher: {
    name: 'Catch net', family: 'Salvage', rarity: 'common',
    description: "Kills within 18 units grant 3 extra scrap.",
    sigil: "\\#:#/\n \\#/\n  ||", maxStacks: 1
  },
  crowfoot: {
    name: 'Caltrop ring', family: 'Control', rarity: 'common',
    description: "Hostiles within 16 units of the core move 20% slower.",
    sigil: "   ^\n <+^+>\n   v", maxStacks: 1
  },
  glass: {
    name: 'Glass chamber', family: 'Ballistics', rarity: 'uncommon',
    description: "Deal 45% more shot damage. Core impacts deal 25% more damage.",
    sigil: "  /\\\n <##>\n  \\/", maxStacks: 1
  },
  rail: {
    name: 'Long rail', family: 'Ballistics', rarity: 'uncommon',
    description: "Gain 30% range. Fire 12% slower.",
    sigil: " /======>\n/======>\n    ||", maxStacks: 1
  },
  repeater: {
    name: 'Drum feed', family: 'Ballistics', rarity: 'uncommon',
    description: "Fire 45% faster. Shots deal 20% less damage.",
    sigil: " .-::-.\n |oooo|\n  ==>>", maxStacks: 1
  },
  redline: {
    name: 'Redline relay', family: 'Ballistics', rarity: 'uncommon',
    description: "Fire 55% faster while core integrity is below half.",
    sigil: " __/|\n/ / |__\n /__|", maxStacks: 1
  },
  ballast: {
    name: 'Stone heart', family: 'Defense', rarity: 'uncommon',
    description: "Gain 40 maximum integrity and heal 40. Lose 7 range.",
    sigil: "  _  _\n /##V#\\\n \\###/", maxStacks: 1
  },
  tracer: {
    name: 'Splinter cap', family: 'Ordnance', rarity: 'uncommon',
    description: "Critical hits spray nearby enemies within 11 units for half the critical damage.",
    sigil: "  \\|/\n--+*+--\n ./|\\.", maxStacks: 1
  },
  royalty: {
    name: 'Royal seal', family: 'Salvage', rarity: 'uncommon',
    description: "Gain 18 scrap whenever you install a relic, including this one.",
    sigil: " .-$$-.\n|  R  |\n '-==-'", maxStacks: 1
  },
  mortar: {
    name: 'Siege mortar', family: 'Ordnance', rarity: 'uncommon',
    description: "Every 16 seconds, strike the healthiest enemy in range for double shot damage.",
    sigil: "   _//\n _//\n(____)", maxStacks: 1
  },
  packhunter: {
    name: 'Hunting horn', family: 'Control', rarity: 'uncommon',
    description: "Deal 40% more damage to a target with two other hostiles within 12 units.",
    sigil: "   __o\no_/\n  \\__o", maxStacks: 1
  },
  mesh: {
    name: 'Copper braid', family: 'Ordnance', rarity: 'uncommon',
    description: "Gain 2 arc jumps. Halve blast radius.",
    sigil: "o--. .-o\n   X\no--' '-o", maxStacks: 1
  },
  precision: {
    name: 'Loaded dice', family: 'Ballistics', rarity: 'uncommon',
    description: "Gain 25 critical chance points. Critical hits deal 1.6x damage.",
    sigil: " .---.\n |o o|\n |.o.|", maxStacks: 1
  },
  returnfire: {
    name: 'Spite coil', family: 'Defense', rarity: 'uncommon',
    description: "Core impacts deal twice the damage taken to hostiles within 22 units.",
    sigil: " ((@))\n--/|\\--\n   |", maxStacks: 1
  },
  fuse: {
    name: 'Phoenix fuse', family: 'Defense', rarity: 'rare', rare: true,
    description: "Once per run, survive a lethal impact at 40% maximum integrity.",
    sigil: "\\_ ^ _/\n  /#\\\n // \\\\", maxStacks: 1
  },
  execute: {
    name: 'Mercy blade', family: 'Ballistics', rarity: 'rare', rare: true,
    description: "Primary shots execute surviving non-boss targets at or below 15% integrity.",
    sigil: "   /|\n  / |\n o--+", maxStacks: 1
  },
  bloom: {
    name: 'Death bloom', family: 'Ordnance', rarity: 'rare', rare: true,
    description: "Destroyed enemies explode for 80% shot damage within 13 units.",
    sigil: "  .*.\n-*(@)*-\n  '*'", maxStacks: 1
  },
  regicide: {
    name: 'Crown breaker', family: 'Ballistics', rarity: 'rare', rare: true,
    description: "Gain 22% shot damage per boss defeated this run, up to four bosses.",
    sigil: " /V^V\\\n |/ /|\n  -/-", maxStacks: 1
  },
  galvanic: {
    name: 'Heart spark', family: 'Defense', rarity: 'rare', rare: true,
    description: "Each critical shot restores 1 core integrity.",
    sigil: " /+\\ /+\\\n \\ /\\ /\n  \\/", maxStacks: 1
  },
  stasis: {
    name: 'Stopped clock', family: 'Control', rarity: 'rare', rare: true,
    description: "Hostiles in firing range freeze for the first 2 seconds of each 12-second cycle.",
    sigil: " .-||-.\n | || |\n '-||-'", maxStacks: 1
  },
  horizon: {
    name: 'Sky bell', family: 'Ordnance', rarity: 'rare', rare: true,
    description: "Every 30 seconds, hit every hostile on the field for double shot damage.",
    sigil: "  .^.\n /___\\\n---o---", maxStacks: 1
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

// Multipliers apply to the normal pressure curve. Supply is an opening scrap bonus.
export const RUN_PROFILES = {
  baseline: {
    name: 'The frontier', description: 'A mixed column on all approaches.',
    tactic: 'Build for both fast contacts and armored targets.',
    hp: 1, speed: 1, damage: 1, interval: 1, salvage: 1, supply: 0, enemyWeights: {}
  },
  stampede: {
    name: 'Moth flight', description: 'More moths. Hostiles are faster and lighter.',
    tactic: 'Fire rate and close-range control catch the rush.',
    hp: .85, speed: 1.12, damage: 1, interval: .92, salvage: 1, supply: 3,
    enemyWeights: { moth: 2.6, brute: .65, aegis: .8 }
  },
  armory: {
    name: 'Iron convoy', description: 'Extra brutes and shield carriers. Slow, rich targets.',
    tactic: 'Use concentrated fire to break armor and shields.',
    hp: 1.15, speed: .89, damage: 1.04, interval: 1.1, salvage: 1.2, supply: 5,
    enemyWeights: { brute: 2.7, aegis: 2.2, moth: .65 }
  },
  brood: {
    name: 'Brood country', description: 'Dense packs of fragile crawlers and splitters.',
    tactic: 'Blast and arc weapons punish tight groups.',
    hp: .80, speed: 1, damage: .92, interval: .83, salvage: .91, supply: 1,
    enemyWeights: { crawler: 1.45, splitter: 2.9, brute: .65 }
  },
  choir: {
    name: 'Wraith choir', description: 'Wraiths lead the attack. Cantors gather behind them.',
    tactic: 'Focus healers before their pulses sustain the pack.',
    hp: .95, speed: 1.05, damage: 1, interval: 1, salvage: 1.08, supply: 4,
    enemyWeights: { wraith: 2.15, cantor: 3.4, moth: .72 }
  },
  crosswind: {
    name: 'Red squall', description: 'Fast, brittle hostiles strike hard on arrival.',
    tactic: 'Extra range buys time against the fast approach.',
    hp: .74, speed: 1.24, damage: 1.22, interval: 1.04, salvage: 1, supply: 6,
    enemyWeights: { wraith: 1.6, crawler: .85 }
  },
  caravan: {
    name: 'Scrap caravan', description: 'Rich salvage and a larger reserve. Enemies hit harder.',
    tactic: 'Spend the extra scrap before the convoy reaches the core.',
    hp: 1.17, speed: 1.03, damage: 1.16, interval: 1.02, salvage: 1.32, supply: 14,
    enemyWeights: { crawler: .87, brute: 1.35, aegis: 1.45 }
  }
};
