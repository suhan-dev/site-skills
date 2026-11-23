// The chat's words in both languages. Imported by chat.js; adds to the tables in i18n.js (team-site-design-system).
// The header's chat button stays English; the panel follows the language switch.
import { D } from "./i18n.js";

Object.assign(D.en, {
  "chat.title": "Team chat", "chat.all": "All", "chat.here": "This page", "chat.close": "Close",
  "chat.ph": "Message the team", "chat.send": "Send", "chat.quoting": "Commenting on", "chat.unquote": "Remove the passage",
  "chat.go": "Go to text", "chat.delete": "Delete", "chat.deleteSure": "Delete?", "chat.you": "You",
  "chat.empty": "No messages yet. Write below, or drag over any text in the notes, logs or papers to comment on it.",
  "chat.emptyTouch": "No messages yet. Write below, or select any text in the notes, logs or papers to comment on it.",
  "chat.emptyHere": "No comments on this page yet. Drag over a passage and choose Comment.",
  "chat.emptyHereTouch": "No comments on this page yet. Select a passage and tap Comment.",
  "chat.off": "Chat isn't connected yet. Copy still works.", "chat.err": "Couldn't send. Try again.", "chat.errDel": "Couldn't delete.",
  "chat.copy": "Copy", "chat.copied": "Copied", "chat.comment": "Comment", "chat.today": "Today", "chat.yesterday": "Yesterday",
  "chat.markTitle": "Show the comment", "chat.event": "Event",
});

Object.assign(D.ko, {
  "chat.title": "팀 채팅", "chat.all": "전체", "chat.here": "이 페이지", "chat.close": "닫기",
  "chat.ph": "팀에게 메시지", "chat.send": "보내기", "chat.quoting": "코멘트할 구절", "chat.unquote": "구절 빼기",
  "chat.go": "본문으로", "chat.delete": "삭제", "chat.deleteSure": "삭제할까요?", "chat.you": "나",
  "chat.empty": "아직 메시지가 없습니다. 아래에 쓰거나, 노트 · 기록 · 논문의 글을 드래그해 코멘트를 남깁니다.",
  "chat.emptyTouch": "아직 메시지가 없습니다. 아래에 쓰거나, 노트 · 기록 · 논문의 글을 선택해 코멘트를 남깁니다.",
  "chat.emptyHere": "이 페이지에 단 코멘트가 아직 없습니다. 구절을 드래그하고 \"코멘트\" 를 누릅니다.",
  "chat.emptyHereTouch": "이 페이지에 단 코멘트가 아직 없습니다. 구절을 선택하고 \"코멘트\" 를 누릅니다.",
  "chat.off": "채팅이 아직 연결되지 않았습니다. 복사는 됩니다.", "chat.err": "보내지 못했습니다. 다시 시도하세요.", "chat.errDel": "지우지 못했습니다.",
  "chat.copy": "복사", "chat.copied": "복사됨", "chat.comment": "코멘트", "chat.today": "오늘", "chat.yesterday": "어제",
  "chat.markTitle": "코멘트 보기", "chat.event": "일정",
});
