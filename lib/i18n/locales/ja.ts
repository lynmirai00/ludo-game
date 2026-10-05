// Japanese. Keys must match en.ts exactly (checked by the Locale type). Plurals only use `other`.
import type { Locale } from '../index';

const ja: Locale = {
  app: {
    title: 'ルドー',
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
  },
  token: {
    label: '{color}のコマ{number}',
  },
  player: {
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
    goal: { self: 'コマがゴールしました。', other: '{player}のコマがゴールしました。' },
    extraTurn: { self: 'もう一度振れます。', other: '{player}はもう一度振れます。' },
    win: { self: 'あなたの勝ちです！', other: '{player}の勝ちです。' },
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
  leaderboard: {
    title: 'ランキング',
    empty: 'まだ誰もいません。一番乗りを目指しましょう！',
  },
  admin: {
    clearLeaderboard: 'ランキングをリセット',
  },
  errors: {
    UNAUTHORIZED: 'セッションの有効期限が切れました。もう一度ログインしてください。',
    FORBIDDEN: 'この操作を行う権限がありません。',
    ILLEGAL_MOVE: 'その手は打てません。',
    NETWORK: 'サーバーに接続できません。通信環境を確認してください。',
    UNKNOWN: 'エラーが発生しました。もう一度お試しください。',
  },
};

export default ja;
