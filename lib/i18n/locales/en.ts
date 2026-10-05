// English: the default language and the source of truth for keys.
// Every key added here must also be added to vi.ts and ja.ts.
const en = {
  app: {
    title: 'Ludo',
  },
  lang: {
    label: 'Language',
  },
  game: {
    roll: 'Roll',
    newGame: 'New game',
    opponents: 'Opponents',
    bots: { one: '{count} bot', other: '{count} bots' },
    log: 'Game log',
    dice: 'Dice',
    lastRoll: 'Last roll: {value}',
    board: 'Game board',
    ranking: 'Ranking',
    fastBots: 'Fast bots',
  },
  turn: {
    self: 'Your turn',
    other: "{player}'s turn",
  },
  hint: {
    roll: 'Press Roll to take your turn.',
    move: 'Pick a highlighted token to move.',
    botThinking: '{player} is thinking…',
    gameOver: 'Press New game to play again.',
    watching: 'The others are still playing for the remaining places.',
  },
  // Finishing places; used as {place} in events.finish.
  rank: {
    first: '1st',
    second: '2nd',
    third: '3rd',
    fourth: '4th',
  },
  token: {
    label: '{color} token {number}',
  },
  player: {
    you: 'You',
    bot: '{color} bot',
  },
  colors: {
    red: 'Red',
    green: 'Green',
    yellow: 'Yellow',
    blue: 'Blue',
  },
  events: {
    rolled: { self: 'You rolled a {value}.', other: '{player} rolled a {value}.' },
    noMove: { self: 'You have no legal move.', other: '{player} has no legal move.' },
    enter: { self: 'You brought a token out.', other: '{player} brought a token out.' },
    capture: { self: 'You captured a {color} token!', other: '{player} captured a {color} token!' },
    step: { self: 'Your token climbed to step {step}.', other: "{player}'s token climbed to step {step}." },
    extraTurn: { self: 'You get another turn.', other: '{player} gets another turn.' },
    finish: { self: 'You came in {place}!', other: '{player} came in {place}.' },
  },
  auth: {
    login: 'Log in',
    logout: 'Log out',
    prompt: 'Log in to save your results',
    unreachable: "Can't reach the login server. Your results won't be saved.",
  },
  stats: {
    // Usage: t('stats.summary', { wins: t('stats.wins', { count }), games: t('stats.games', { count }) })
    wins: { one: '{count} win', other: '{count} wins' },
    games: { one: '{count} game', other: '{count} games' },
    summary: '{wins} out of {games}',
  },
  result: {
    saved: 'Result saved to your account.',
    notSaved: "You're not logged in, so this result wasn't saved.",
  },
  leaderboard: {
    title: 'Leaderboard',
    empty: 'No one here yet. Be the first!',
    mostWins: 'Most wins',
    fastestWins: 'Fastest wins',
    players: { one: '{count} player', other: '{count} players' },
    rolls: { one: '{count} roll', other: '{count} rolls' },
  },
  admin: {
    clearLeaderboard: 'Clear leaderboard',
  },
  errors: {
    UNAUTHORIZED: 'Your session has expired. Please log in again.',
    FORBIDDEN: "You don't have permission to do that.",
    ILLEGAL_MOVE: "That move isn't allowed.",
    NETWORK: "Can't reach the server. Check your connection.",
    UNKNOWN: 'Something went wrong. Please try again.',
  },
};

export default en;
