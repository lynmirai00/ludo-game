// English: the default language and the source of truth for keys.
// Every key added here must also be added to vi.ts and ja.ts.
const en = {
  app: {
    title: 'Ludo',
  },
  crash: {
    title: 'This browser couldn\'t run the game',
    message: 'Please open the game in an up-to-date Safari or Chrome. If you opened it from a chat app, choose “Open in browser”.',
    retry: 'Try again',
    noScript: 'This game needs JavaScript. Please turn it on, or open the game in an up-to-date Safari or Chrome.',
  },
  menu: {
    open: 'Open menu',
    close: 'Close menu',
    title: 'Menu',
  },
  nav: {
    back: 'Back',
  },
  account: {
    title: 'Account',
  },
  rules: {
    title: 'How to play',
    items: {
      players: '2 to 4 players, 4 horses each. You always play Red. Horses move counterclockwise, following the arrows.',
      leave: 'Roll a 1 or a 6 to bring a horse out onto your start cell (the arrow next to your base).',
      move: 'Move one horse exactly the number rolled. If a horse can move, you must move one.',
      block: 'A horse may not jump over another horse, and may not stop on a horse of its own color.',
      capture: 'Stop exactly on an opponent\'s horse to send it back to its base. There are no safe cells.',
      extra: 'A 1 or a 6 gives you another roll.',
      entrance: 'After a full lap, a horse must stop exactly on the cell just before its home column.',
      home: 'From there, a roll of N moves it straight to step N. After that it climbs one step at a time, only with a roll of exactly the next step: from step 3 you need a 4.',
      finish: 'The first to get all 4 horses onto steps 3–6 comes first. The others play on for the remaining places.',
      saved: 'Log in to save your results, appear on the leaderboards and replay your games.',
    },
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
  match: {
    resumed: 'Continued your unfinished game.',
  },
  replay: {
    button: 'Replay',
    title: 'Replay',
    play: 'Play',
    pause: 'Pause',
    prev: 'Previous step',
    next: 'Next step',
    position: 'Step {current} of {total}',
    close: 'Back to the game',
  },
  privacy: {
    title: 'Your data',
    note: 'This game stores your player ID from the login service, your display name, your language and your game results. It never stores your email address or password.',
    delete: 'Delete my data',
    confirmDelete: 'Delete your results, history and saved games from this game? Your login account is not deleted. This cannot be undone.',
  },
  history: {
    title: 'My games',
    empty: 'No games yet. Finish a game while logged in to see it here.',
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
    clearLeaderboard: 'Reset leaderboards',
    confirmClear: 'Reset both leaderboards? Players keep their own history and stats.',
    cleared: 'The leaderboards were reset.',
  },
  errors: {
    NOT_FOUND: 'That game doesn\'t exist anymore.',
    CONFLICT: 'This game was changed elsewhere. The latest state has been loaded.',
    MATCH_OVER: 'This game is already over.',
    UNAUTHORIZED: 'Your session has expired. Please log in again.',
    FORBIDDEN: "You don't have permission to do that.",
    ILLEGAL_MOVE: "That move isn't allowed.",
    NETWORK: "Can't reach the server. Check your connection.",
    UNKNOWN: 'Something went wrong. Please try again.',
  },
};

export default en;
