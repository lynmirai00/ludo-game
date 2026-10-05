// Japanese. Keys must match en.ts exactly (checked by the Locale type). Plurals only use `other`.
import type { Locale } from '../index';

const ja: Locale = {
  app: {
    title: 'ルドー',
  },
  crash: {
    title: 'このブラウザではゲームを実行できませんでした',
    message: '最新のSafariまたはChromeで開いてください。チャットアプリから開いた場合は「ブラウザで開く」を選んでください。',
    retry: '再試行',
    noScript: 'このゲームにはJavaScriptが必要です。JavaScriptを有効にするか、最新のSafariまたはChromeで開いてください。',
  },
  menu: {
    open: 'メニューを開く',
    close: 'メニューを閉じる',
    title: 'メニュー',
  },
  nav: {
    back: '戻る',
  },
  account: {
    title: 'アカウント',
  },
  rules: {
    title: '遊び方',
    items: {
      players: '2〜4人で遊び、1人4頭の馬を使います。あなたはいつも赤です。馬は矢印のとおり反時計回りに進みます。',
      leave: '1か6が出たら、馬を1頭スタートのマス（陣地の横の矢印のマス）に出せます。',
      move: '出た目の数だけ、馬を1頭進めます。動かせる馬がいるときは、必ず動かさなければなりません。',
      block: 'ほかの馬を飛び越えることはできません。また、自分の色の馬がいるマスには止まれません。',
      capture: '相手の馬がいるマスにぴったり止まると、その馬を陣地に戻せます。安全なマスはありません。',
      extra: '1か6が出たら、もう一度振れます。',
      entrance: '一周したら、自分のゴールの列の手前のマスにぴったり止まる必要があります。',
      home: 'そこからNが出ると、N段目まで一気に上がれます。その後は1段ずつで、次の段と同じ目が出たときだけ上がれます（3段目なら4が必要です）。',
      finish: '4頭すべてを3〜6段目にそろえた人から順位が決まります。残りの人は、残りの順位をかけて続けます。',
      saved: 'ログインすると、成績が保存され、ランキングに載り、対戦をリプレイで見返せます。',
    },
  },
  lang: {
    label: '言語',
  },
  game: {
    roll: 'サイコロを振る',
    newGame: '新しいゲーム',
    opponents: '対戦相手',
    bots: { other: 'CPU {count}人' },
    log: 'ゲームの記録',
    dice: 'サイコロ',
    lastRoll: '出た目：{value}',
    board: 'ゲーム盤',
    ranking: '順位',
    fastBots: '早送り',
  },
  turn: {
    self: 'あなたの番です',
    other: '{player}の番です',
  },
  hint: {
    roll: '「サイコロを振る」を押してください。',
    move: '光っているコマを選んでください。',
    botThinking: '{player}が考えています…',
    gameOver: '「新しいゲーム」を押すと、もう一度遊べます。',
    watching: '残りの順位を決めるため、ほかのプレイヤーが対戦中です。',
  },
  // Finishing places; used as {place} in events.finish.
  rank: {
    first: '1位',
    second: '2位',
    third: '3位',
    fourth: '4位',
  },
  token: {
    label: '{color}のコマ{number}',
  },
  player: {
    you: 'あなた',
    bot: 'CPU（{color}）',
  },
  colors: {
    red: '赤',
    green: '緑',
    yellow: '黄',
    blue: '青',
  },
  events: {
    rolled: { self: 'あなたは{value}を出しました。', other: '{player}は{value}を出しました。' },
    noMove: { self: '動かせるコマがありません。', other: '{player}は動かせるコマがありません。' },
    enter: { self: 'コマを出しました。', other: '{player}がコマを出しました。' },
    capture: { self: '{color}のコマを取りました！', other: '{player}が{color}のコマを取りました！' },
    step: { self: 'コマが{step}段目に上がりました。', other: '{player}のコマが{step}段目に上がりました。' },
    extraTurn: { self: 'もう一度振れます。', other: '{player}はもう一度振れます。' },
    finish: { self: 'あなたは{place}でゴールしました！', other: '{player}は{place}でゴールしました。' },
  },
  auth: {
    login: 'ログイン',
    logout: 'ログアウト',
    prompt: 'ログインすると成績が保存されます',
    unreachable: 'ログインサーバーに接続できません。成績は保存されません。',
  },
  stats: {
    wins: { other: '{count}勝' },
    games: { other: '{count}戦' },
    summary: '{games}{wins}',
  },
  result: {
    saved: '結果をアカウントに保存しました。',
    notSaved: 'ログインしていないため、この結果は保存されませんでした。',
  },
  match: {
    resumed: '途中のゲームを再開しました。',
  },
  replay: {
    button: 'リプレイ',
    title: 'リプレイ',
    play: '再生',
    pause: '一時停止',
    prev: '前の手',
    next: '次の手',
    position: '{total}手中{current}手目',
    close: 'ゲームに戻る',
  },
  privacy: {
    title: 'データについて',
    note: 'このゲームは、ログインサービスのプレイヤーID、表示名、言語、対戦結果を保存します。メールアドレスとパスワードは保存しません。',
    delete: 'データを削除',
    confirmDelete: 'このゲームから成績・履歴・保存したゲームを削除しますか？ログイン用のアカウントは削除されません。元に戻すことはできません。',
  },
  history: {
    title: '対戦履歴',
    empty: 'まだ対戦記録がありません。ログインした状態でゲームを最後までプレイしてください。',
  },
  leaderboard: {
    title: 'ランキング',
    empty: 'まだ誰もいません。一番乗りを目指しましょう！',
    mostWins: '勝利数',
    fastestWins: '最速勝利',
    players: { other: '{count}人' },
    rolls: { other: '{count}回' },
  },
  admin: {
    clearLeaderboard: 'ランキングをリセット',
    confirmClear: '両方のランキングをリセットしますか？各プレイヤーの履歴と成績はそのまま残ります。',
    cleared: 'ランキングをリセットしました。',
  },
  errors: {
    NOT_FOUND: 'このゲームはもう存在しません。',
    CONFLICT: 'このゲームは別の場所で更新されました。最新の状態を読み込みました。',
    MATCH_OVER: 'このゲームはすでに終了しています。',
    UNAUTHORIZED: 'セッションの有効期限が切れました。もう一度ログインしてください。',
    FORBIDDEN: 'この操作を行う権限がありません。',
    ILLEGAL_MOVE: 'その手は打てません。',
    NETWORK: 'サーバーに接続できません。通信環境を確認してください。',
    UNKNOWN: 'エラーが発生しました。もう一度お試しください。',
  },
};

export default ja;
