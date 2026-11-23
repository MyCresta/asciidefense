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
    maxLevel: 16, soft: 10, baseCost: 10, growth: 1.48
  },
  rate: {
    name: 'Fire rate', label: 'Fire rate', group: 'arsenal',
    description: 'Fire more shots per second.',
    icon: '  // //\n // // \n// //  ',
    maxLevel: 16, soft: 10, baseCost: 14, growth: 1.48
  },
  splash: {
    name: 'Splash', label: 'Splash', group: 'arsenal',
    description: 'Hit hostiles around the primary target.',
    icon: '\\  |  /\n-- * --\n/  |  \\',
    maxLevel: 14, soft: 10, baseCost: 18, growth: 1.44
  },
  damage: {
    name: 'Impact', label: 'Impact', group: 'munitions',
    description: 'Increase the damage of each shot.',
    icon: '   /^\\\n==<##>\n   \\v/',
    maxLevel: 16, soft: 10, baseCost: 13, growth: 1.54
  },
  crit: {
    name: 'Critical hit', label: 'Crit chance', group: 'munitions',
    description: 'Raise the chance to deal critical damage.',
    icon: ' \\ ! /\n  [*] \n / ! \\',
    maxLevel: 12, soft: 8, baseCost: 17, growth: 1.53
  },
  chain: {
    name: 'Arc chain', label: 'Arc chain', group: 'munitions',
    description: 'Let shots arc between nearby targets.',
    icon: 'o-.    \n  \\.-o \n   \\.-o',
    maxLevel: 7, soft: 5, baseCost: 24, growth: 1.68
  },
  armor: {
    name: 'Armor', label: 'Armor', group: 'chassis',
    description: 'Reduce damage from every impact on the core.',
    icon: '.====.\n| /\\ |\n \\==/',
    maxLevel: 12, soft: 8, baseCost: 12, growth: 1.49
  },
  regen: {
    name: 'Repair', label: 'Repair', group: 'chassis',
    description: 'Regenerate core integrity over time.',
    icon: '  [+]  \n[+] [+]\n  [+]  ',
    maxLevel: 10, soft: 6, baseCost: 18, growth: 1.57
  },
  bounty: {
    name: 'Bounty', label: 'Bounty', group: 'chassis',
    description: 'Recover more scrap from destroyed hostiles.',
    icon: " .---.\n(  $  )\n '---'",
    maxLevel: 8, soft: 5, baseCost: 20, growth: 1.75
  },
  lethality: {
    name: 'Lethality', label: 'Crit power', group: 'munitions',
    description: 'Critical hits deal 10% more damage per level.',
    icon: ' \\ | /\n-=[X]=-\n / | \\', after: 240, maxLevel: 8, baseCost: 18, growth: 1.5
  },
  incendiary: {
    name: 'Incendiary', label: 'Incendiary', group: 'munitions',
    description: 'Direct hits burn for 8% extra damage per level.',
    icon: '  ) (  \n ( ) ) \n [===] ', after: 240, maxLevel: 8, baseCost: 16, growth: 1.5
  },
  chill: {
    name: 'Chill', label: 'Chill', group: 'arsenal',
    description: 'Direct hits have a 7% chance per level to slow.',
    icon: ' * | * \n--(*)--\n * | * ', after: 240, maxLevel: 8, baseCost: 16, growth: 1.5
  },
  hunter: {
    name: 'Hunter', label: 'Hunter', group: 'arsenal',
    description: 'Deal 8% more damage per level to elites and sovereigns.',
    icon: '  /V\\  \n-<(o)>-\n  \\_/  ', after: 240, maxLevel: 8, baseCost: 18, growth: 1.5
  },
  barrier: {
    name: 'Barrier', label: 'Barrier', group: 'chassis',
    description: 'A core shield absorbs 6 damage per level. It recharges after 4 quiet seconds.',
    icon: " .---. \n( (#) )\n '---' ", after: 240, maxLevel: 8, baseCost: 16, growth: 1.5
  },
  salvage: {
    name: 'Salvage sense', label: 'Salvage', group: 'chassis',
    description: 'Caches drop 6% sooner per level.',
    icon: '  ___  \n |$?$| \n |___| ', after: 240, maxLevel: 6, baseCost: 20, growth: 1.6
  }
};

export const POWERS = {
  reaper: {
    name: 'Reaper die', family: 'Ballistics', rarity: 'uncommon',
    description: '2% chance a hit destroys a non-boss hostile outright.',
    sigil: "  .-.\n (x_x)\n  /|\\", maxStacks: 3
  },
  overkill: {
    name: 'Overkill', family: 'Ballistics', rarity: 'common',
    description: 'Damage past a kill carries to the next hostile.',
    sigil: " >>-o\n    \\\n  o-<<", maxStacks: 1
  },
  ricochet: {
    name: 'Ricochet', family: 'Ballistics', rarity: 'common',
    description: 'Kills bounce a shot to a nearby hostile for 60% damage.',
    sigil: " o   o\n  \\ /\n   V", maxStacks: 2, next: 'Rank II: kills bounce two shots.'
  },
  coinflip: {
    name: 'Coin flip', family: 'Ballistics', rarity: 'uncommon',
    description: 'Each shot deals 50% or 170% damage.',
    sigil: "  .--.\n ( $? )\n  '--'", maxStacks: 1
  },
  hoard: {
    name: 'Dragon hoard', family: 'Salvage', rarity: 'uncommon',
    description: '+3% damage per 100 scrap held, up to +30%.',
    sigil: " /\\_/\\\n( $$$ )\n \\___/", maxStacks: 1
  },
  midas: {
    name: 'Midas gear', family: 'Salvage', rarity: 'common',
    description: 'Every 25th kill pays a scrap burst.',
    sigil: "  .-.\n-( $ )-\n  '-'", maxStacks: 2, next: 'Rank II: every 15th kill pays out.'
  },
  jackpot: {
    name: 'Jackpot', family: 'Salvage', rarity: 'common',
    description: '1 kill in 10 pays triple scrap.',
    sigil: " [7|7|7]\n  \\===/\n   ||", maxStacks: 2, next: 'Rank II: 1 kill in 6 pays triple.'
  },
  warrant: {
    name: 'Bounty board', family: 'Salvage', rarity: 'common',
    description: 'Elites and bosses pay double scrap.',
    sigil: " .----.\n |WANT|\n '----'", maxStacks: 1
  },
  lucky: {
    name: 'Lucky charm', family: 'Salvage', rarity: 'uncommon',
    description: 'Small caches sometimes install a second upgrade.',
    sigil: "  .*.\n <-+->\n  '*'", maxStacks: 2, next: 'Rank II: the second upgrade is more likely.'
  },
  magpie: {
    name: 'Magpie', family: 'Salvage', rarity: 'uncommon',
    description: 'Elites always drop a big cache, at most once every 20 seconds.',
    sigil: "  __\n<(o )___\n (  ._> /", maxStacks: 1
  },
  dilation: {
    name: 'Time dilation', family: 'Control', rarity: 'uncommon',
    description: 'Hostiles slow down near the core, to half speed.',
    sigil: " \\  .  /\n  >(o)<\n /  '  \\", maxStacks: 1
  },
  coldblood: {
    name: 'Cold blood', family: 'Control', rarity: 'common',
    description: 'Slowed hostiles take 30% more damage.',
    sigil: "  *  *\n -[##]-\n  *  *", maxStacks: 2, next: 'Rank II: slowed hostiles take 50% more damage.'
  },
  pyre: {
    name: 'Pyre', family: 'Ordnance', rarity: 'common',
    description: 'Burning hostiles take 25% more damage.',
    sigil: "  ) (\n ( ) )\n [###]", maxStacks: 2, next: 'Rank II: burning hostiles take 45% more damage.'
  },
  wildcard: {
    name: 'Wild card', family: 'Salvage', rarity: 'rare', rare: true,
    description: 'Install two random relics.',
    sigil: " .---.\n | ? |\n '---'", maxStacks: 1
  },
  twinshot: {
    name: 'Forked bolt', family: 'Ballistics', rarity: 'rare', rare: true,
    description: 'Fire a second bolt at another target for 65% damage.',
    sigil: "      .==>\n====<     \n      '==>", maxStacks: 2, next: 'Rank II: fire a third bolt as well.'
  },
  overclock: {
    name: 'Overclock', family: 'Ballistics', rarity: 'common',
    description: 'Increase fire rate by 15%.',
    sigil: '   / / /\n==/=/=/==\n / / /', maxStacks: 3
  },
  fracture: {
    name: 'Shatter lens', family: 'Ordnance', rarity: 'common',
    description: 'Add 8 units of blast radius to each shot.',
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
    sigil: ' \\  |  /\n--\\-*- /--\n  / | \\', maxStacks: 2, next: 'Rank II: the slow lasts 5 seconds.'
  },
  ember: {
    name: 'Cinder rounds', family: 'Ordnance', rarity: 'common',
    description: 'Direct hits burn for 60% extra damage over 3 seconds.',
    sigil: '   /).\n  /)( \\ \n  \\##/', maxStacks: 2, next: 'Rank II: burns deal 100% extra damage.'
  },
  headhunter: {
    name: 'Kingslayer', family: 'Ballistics', rarity: 'common',
    description: 'Deal 40% more damage to tier III and IV enemies.',
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
    sigil: "  .---.\n / [#] \\\n '.___.'", maxStacks: 2, next: 'Rank II: the ward recharges in 14 seconds.'
  },
  repulse: {
    name: 'Repulsor', family: 'Control', rarity: 'rare', rare: true,
    description: 'Every 10 seconds, push enemies in range outward by 10 units.',
    sigil: "  .-=-.\n<(  +  )>\n  '-=-'", maxStacks: 2, next: 'Rank II: pulse every 7 seconds.'
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
    description: "Deal 35% more shot damage. Core impacts deal 25% more damage.",
    sigil: "  /\\\n <##>\n  \\/", maxStacks: 1
  },
  rail: {
    name: 'Long rail', family: 'Ballistics', rarity: 'uncommon',
    description: "Gain 30% range. Fire 12% slower.",
    sigil: " /======>\n/======>\n    ||", maxStacks: 1
  },
  repeater: {
    name: 'Drum feed', family: 'Ballistics', rarity: 'uncommon',
    description: "Fire 35% faster. Shots deal 20% less damage.",
    sigil: " .-::-.\n |oooo|\n  ==>>", maxStacks: 1
  },
  redline: {
    name: 'Redline relay', family: 'Ballistics', rarity: 'uncommon',
    description: "Fire 40% faster while core integrity is below half.",
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
    description: "Gain 18 critical chance points. Critical hits deal 1.6x damage.",
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
    sigil: "   /|\n  / |\n o--+", maxStacks: 2, next: 'Rank II: execute at or below 20% integrity.'
  },
  bloom: {
    name: 'Death bloom', family: 'Ordnance', rarity: 'rare', rare: true,
    description: "Destroyed enemies explode for 80% shot damage within 13 units.",
    sigil: "  .*.\n-*(@)*-\n  '*'", maxStacks: 2, next: 'Rank II: 110% damage within 17 units.'
  },
  regicide: {
    name: 'Crown breaker', family: 'Ballistics', rarity: 'rare', rare: true,
    description: "Gain 15% shot damage per boss defeated this run, up to four bosses.",
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
    sigil: "  .^.\n /___\\\n---o---", maxStacks: 2, next: 'Rank II: the bell rings every 20 seconds.'
  },
  deadeye: {
    name: 'Deadeye', family: 'Ballistics', rarity: 'common',
    description: 'Gain 6 critical chance points. Critical hits deal 15% more.',
    sigil: "  .-.\n-(-o-)-\n  '-'", maxStacks: 2
  },
  quickdraw: {
    name: 'Quickdraw', family: 'Ballistics', rarity: 'common',
    description: 'Fire 20% faster while core integrity is full.',
    sigil: "  _\n-| |==>\n  T", maxStacks: 1
  },
  slug: {
    name: 'Heavy slug', family: 'Ballistics', rarity: 'common',
    description: 'Deal 30% more damage to shielded, plated and armored hostiles.',
    sigil: " .---.\n(#####)\n '---'", maxStacks: 1
  },
  tracker: {
    name: 'Tracking rounds', family: 'Ballistics', rarity: 'common',
    description: 'Deal 25% more damage to moths, wraiths and swift elites.',
    sigil: "  >o\n >>o\n  >o", maxStacks: 1
  },
  warcry: {
    name: 'War drum', family: 'Ballistics', rarity: 'uncommon',
    description: 'Fire 30% faster while a sovereign is on the field.',
    sigil: " .===.\n |(O)|\n '==='", maxStacks: 1
  },
  momentum: {
    name: 'Momentum', family: 'Ballistics', rarity: 'uncommon',
    description: 'Each kill adds 3% fire rate for 4 seconds, up to 30%.',
    sigil: " >  >\n  >  >\n >  >", maxStacks: 1
  },
  echo: {
    name: 'Echo chamber', family: 'Ballistics', rarity: 'rare', rare: true,
    description: 'Every 4th primary shot deals double damage.',
    sigil: " ((o))\n(( o ))\n ((o))", maxStacks: 1
  },
  overdrive: {
    name: 'Overdrive', family: 'Ballistics', rarity: 'rare', rare: true,
    description: 'Fire twice as fast for 6 seconds out of every 45.',
    sigil: " /!!\\\n|>>>>|\n \\!!/", maxStacks: 1
  },
  kindling: {
    name: 'Kindling', family: 'Ordnance', rarity: 'common',
    description: 'Burns deal 50% more damage.',
    sigil: "  ( )\n ( ( )\n /###\\", maxStacks: 1
  },
  shrapnel: {
    name: 'Shrapnel', family: 'Ordnance', rarity: 'common',
    description: 'Blast hits deal 30% more damage.',
    sigil: " . * .\n* (o) *\n ' * '", maxStacks: 2
  },
  conductor: {
    name: 'Ground wire', family: 'Ordnance', rarity: 'common',
    description: 'Arc jumps deal 30% more damage.',
    sigil: " o-o-o\n   |\n  _|_", maxStacks: 1
  },
  flashbang: {
    name: 'Flash powder', family: 'Ordnance', rarity: 'common',
    description: 'Blast hits slow their targets for 1.5 seconds.',
    sigil: "  \\|/\n -(*)-\n  /|\\", maxStacks: 1
  },
  static: {
    name: 'Static charge', family: 'Ordnance', rarity: 'uncommon',
    description: 'Every 8 seconds, lightning strikes 4 hostiles in range for shot damage.',
    sigil: "   /\n  /_\n   /", maxStacks: 1
  },
  starfall: {
    name: 'Starfall', family: 'Ordnance', rarity: 'rare', rare: true,
    description: 'Every 20 seconds, the 3 healthiest hostiles in range take triple shot damage.',
    sigil: " *  .\n   *\n.  *  *", maxStacks: 1
  },
  prism: {
    name: 'Prism', family: 'Ordnance', rarity: 'rare', rare: true,
    description: 'Critical hits split into 2 beams for 50% damage.',
    sigil: "   /\\\n  /  \\-\n /____\\=", maxStacks: 1
  },
  tarpit: {
    name: 'Tar pit', family: 'Control', rarity: 'common',
    description: 'Hostiles within 24 units move 15% slower and take 10% more damage.',
    sigil: " ~~~~~\n~(___)~\n ~~~~~", maxStacks: 1
  },
  brittle: {
    name: 'Brittle frost', family: 'Control', rarity: 'common',
    description: 'Hits on slowed hostiles gain 15 critical chance points.',
    sigil: " *-+-*\n  /*\\\n *-+-*", maxStacks: 1
  },
  anchor: {
    name: 'Anchor chain', family: 'Control', rarity: 'uncommon',
    description: 'Elites and sovereigns move 25% slower.',
    sigil: "   O\n  -+-\n \\_|_/", maxStacks: 1
  },
  nova: {
    name: 'Frost nova', family: 'Control', rarity: 'uncommon',
    description: 'Every 15 seconds, freeze hostiles within 25 units for 1.5 seconds.',
    sigil: " * . *\n. (*) .\n * . *", maxStacks: 1
  },
  tithe: {
    name: 'Tithe box', family: 'Salvage', rarity: 'common',
    description: 'Every 30 seconds, gain 2% of your scrap, up to 20.',
    sigil: " .---.\n |$%$|\n '---'", maxStacks: 1
  },
  scavenger: {
    name: 'Scavenger', family: 'Salvage', rarity: 'common',
    description: 'Caches drop 15% sooner.',
    sigil: "  __\n /oo\\\n/_||_\\", maxStacks: 1
  },
  recycler: {
    name: 'Recycler', family: 'Salvage', rarity: 'common',
    description: 'Reclaimed blueprints and weapons pay 50% more scrap.',
    sigil: "  .->.\n (  $ )\n  '<-'", maxStacks: 1
  },
  smelter: {
    name: 'Smelter', family: 'Salvage', rarity: 'common',
    description: 'Forging weapons costs 15% less.',
    sigil: " |   |\n |###|\n '==='", maxStacks: 2
  },
  appraiser: {
    name: 'Appraiser', family: 'Salvage', rarity: 'uncommon',
    description: 'Big cache blueprints roll higher grades.',
    sigil: "  .-.\n (o o)\n  |=|$", maxStacks: 1
  },
  broker: {
    name: 'Broker', family: 'Salvage', rarity: 'uncommon',
    description: 'The first reroll of each big cache is free.',
    sigil: " <-$->\n  | |\n <-$->", maxStacks: 1
  },
  plating: {
    name: 'Reactive plate', family: 'Defense', rarity: 'common',
    description: 'After a core impact, gain 6 armor for 3 seconds.',
    sigil: " /###\\\n|#<>#|\n \\###/", maxStacks: 1
  },
  overshield: {
    name: 'Overshield', family: 'Defense', rarity: 'common',
    description: 'Gain 15 barrier. Barrier recharges twice as fast.',
    sigil: " .===.\n((+++))\n '==='", maxStacks: 1
  },
  lifeline: {
    name: 'Lifeline', family: 'Defense', rarity: 'uncommon',
    description: 'Each sovereign defeated restores 30% integrity.',
    sigil: "    /\\\n___/  \\  _\n       \\/", maxStacks: 1
  },
  bulkhead: {
    name: 'Bulkhead', family: 'Defense', rarity: 'rare', rare: true,
    description: 'No single impact deals more than 12% of maximum integrity.',
    sigil: " |===|\n |=+=|\n |===|", maxStacks: 1
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
  },
  meltdown: {
    name: 'Meltdown', power: 'kindling', upgrade: 'incendiary', level: 3,
    description: 'Burns deal another 50% more damage.'
  },
  permafrost: {
    name: 'Permafrost', power: 'nova', upgrade: 'chill', level: 3,
    description: 'Frost nova freezes for 3 seconds.'
  },
  killzone: {
    name: 'Kill zone', power: 'tarpit', upgrade: 'splash', level: 4,
    description: 'Tar pit reaches 34 units.'
  },
  executioner: {
    name: 'Executioner', power: 'deadeye', upgrade: 'lethality', level: 3,
    description: 'Critical hits deal another 25% more.'
  },
  bountyhunter: {
    name: 'Bounty hunter', power: 'warrant', upgrade: 'hunter', level: 3,
    description: 'Elite and sovereign kills pay 10 extra scrap.'
  },
  fortress: {
    name: 'Fortress', power: 'overshield', upgrade: 'barrier', level: 3,
    description: 'Barrier recharges after 2 quiet seconds.'
  },
  supercell: {
    name: 'Supercell', power: 'conductor', upgrade: 'chain', level: 3,
    description: 'Shots arc to one additional target.'
  },
  goldrush: {
    name: 'Gold rush', power: 'tithe', upgrade: 'bounty', level: 3,
    description: 'Tithe box pays 3%, up to 40.'
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
