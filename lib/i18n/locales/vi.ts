// Vietnamese. Keys must match en.ts exactly (checked by the Locale type). Plurals only use `other`.
import type { Locale } from '../index';

const vi: Locale = {
  app: {
    title: 'Cờ cá ngựa',
  },
  lang: {
    label: 'Ngôn ngữ',
  },
  game: {
    roll: 'Gieo xúc xắc',
    newGame: 'Ván mới',
    opponents: 'Số đối thủ',
    bots: { other: '{count} máy' },
    log: 'Diễn biến',
    dice: 'Xúc xắc',
    lastRoll: 'Vừa gieo được {value}',
    board: 'Bàn cờ',
    ranking: 'Thứ hạng',
    fastBots: 'Tăng tốc',
  },
  turn: {
    self: 'Lượt của bạn',
    other: 'Lượt của {player}',
  },
  hint: {
    roll: 'Bấm "Gieo xúc xắc" để đi.',
    move: 'Chọn một quân đang nhấp nháy để đi.',
    botThinking: '{player} đang suy nghĩ…',
    gameOver: 'Bấm "Ván mới" để chơi lại.',
    watching: 'Những người còn lại đang chơi tiếp để phân hạng.',
  },
  // Finishing places; used as {place} in events.finish.
  rank: {
    first: 'nhất',
    second: 'nhì',
    third: 'ba',
    fourth: 'tư',
  },
  token: {
    label: 'Quân {color} số {number}',
  },
  player: {
    you: 'Bạn',
    bot: 'Máy {color}',
  },
  colors: {
    red: 'Đỏ',
    green: 'Xanh lá',
    yellow: 'Vàng',
    blue: 'Xanh dương',
  },
  events: {
    rolled: { self: 'Bạn gieo được {value}.', other: '{player} gieo được {value}.' },
    noMove: { self: 'Bạn không có nước đi nào.', other: '{player} không có nước đi nào.' },
    enter: { self: 'Bạn ra quân.', other: '{player} ra quân.' },
    capture: { self: 'Bạn đá quân {color} về chuồng!', other: '{player} đá quân {color} về chuồng!' },
    step: { self: 'Ngựa của bạn lên bậc {step}.', other: 'Ngựa của {player} lên bậc {step}.' },
    extraTurn: { self: 'Bạn được đi thêm lượt.', other: '{player} được đi thêm lượt.' },
    finish: { self: 'Bạn về {place}!', other: '{player} về {place}.' },
  },
  auth: {
    login: 'Đăng nhập',
    logout: 'Đăng xuất',
    prompt: 'Đăng nhập để lưu thành tích',
    unreachable: 'Không kết nối được máy chủ đăng nhập, kết quả sẽ không được lưu.',
  },
  stats: {
    wins: { other: '{count}' },
    games: { other: '{count} ván' },
    summary: 'Thắng {wins}/{games}',
  },
  result: {
    saved: 'Đã lưu kết quả vào tài khoản của bạn.',
    notSaved: 'Bạn chưa đăng nhập nên kết quả không được lưu.',
  },
  match: {
    resumed: 'Đã mở lại ván bạn đang chơi dở.',
  },
  replay: {
    button: 'Xem lại',
    title: 'Xem lại ván đấu',
    play: 'Phát',
    pause: 'Tạm dừng',
    prev: 'Bước trước',
    next: 'Bước sau',
    position: 'Bước {current}/{total}',
    close: 'Quay lại ván chơi',
  },
  history: {
    title: 'Lịch sử của tôi',
    empty: 'Chưa có ván nào. Hãy chơi hết một ván khi đã đăng nhập.',
  },
  leaderboard: {
    title: 'Bảng xếp hạng',
    empty: 'Chưa có ai. Hãy là người đầu tiên!',
    mostWins: 'Thắng nhiều nhất',
    fastestWins: 'Thắng nhanh nhất',
    players: { other: '{count} người' },
    rolls: { other: '{count} lượt gieo' },
  },
  admin: {
    clearLeaderboard: 'Đặt lại bảng xếp hạng',
    confirmClear: 'Đặt lại cả hai bảng xếp hạng? Lịch sử và thành tích riêng của người chơi vẫn được giữ.',
    cleared: 'Đã đặt lại bảng xếp hạng.',
  },
  errors: {
    NOT_FOUND: 'Ván này không còn tồn tại.',
    CONFLICT: 'Ván này vừa được cập nhật ở nơi khác, đã tải lại trạng thái mới nhất.',
    MATCH_OVER: 'Ván này đã kết thúc.',
    UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
    FORBIDDEN: 'Bạn không có quyền làm việc này.',
    ILLEGAL_MOVE: 'Nước đi này không hợp lệ.',
    NETWORK: 'Không kết nối được máy chủ, hãy kiểm tra mạng.',
    UNKNOWN: 'Đã có lỗi xảy ra, vui lòng thử lại.',
  },
};

export default vi;
