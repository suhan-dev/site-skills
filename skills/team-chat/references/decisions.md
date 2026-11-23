# Team chat: decisions

Reasons the source code or the team stated are given plainly. Reasons marked *(inferred)* are our reading of the
choice; check them against your own team.

| Decision | Instead of | Why |
|---|---|---|
| Comments are made by selecting text: Copy · Comment | A comment button on each paragraph, or a separate "discussion" page | Questions are about one sentence; selecting it is the gesture people already use to copy it into a messenger. Copy stays first so the bar never gets in the way of copying. |
| The author comes from the session | A name field or a "who are you" picker | Nobody types a name, nobody can post as someone else, and no address is ever stored. |
| One chat with two tabs, All and This page | One thread per page | A small team talks in one place; This page filters the same messages down to what is on screen. *(inferred)* |
| Quotes are stored with 40 characters on each side and found again by their words | DOM paths or character offsets | Chapters, logs and references are edited all the time; a comment should survive edits around it. If its own words change, it stays in the chat without a mark. |
| A thin accent underline for a commented passage | A highlight colour or a margin icon | Reading comes first; the underline is visible without colouring the text. Matches the design system's "no boxes, no neon". *(inferred)* |
| On touch screens the bar docks at the bottom of the screen | Floating above the selection | iOS and Android show their own selection menu above the selection; a second bar there covers it. |
| Panel beside the page from 1100 px, over it below that, a sheet on phones | A modal dialog | The passage under discussion stays readable next to the chat on a laptop. *(inferred)* |
| Polling with `?since=rev` (4 s open, 45 s closed) | WebSockets or Durable Objects | Pages Functions answer requests and keep no connections; a counter makes each poll small and exact. Three people need nothing more. *(inferred)* |
| One change counter for inserts and deletes; soft deletes | Timestamps, or deleting rows | Timestamps can tie; a deleted row must still tell other browsers to remove it. |
| Long quote, title and context are cut, not refused | Refusing the message | A long selection is a normal thing to comment on; losing the message because of it would be worse. |
| Two taps to delete ("Delete" → "Delete?" for 3 s) | A confirmation dialog | Fast, and a dialog for one line of text is heavy. *(inferred)* |
| No editing | Edit in place | Delete and send again is enough for a short chat, and edits would complicate polling. *(inferred)* |
| No notifications for chat messages | Push for every message | Push on the team's phones is kept for calendar events (`ios-webapp-push`), so it stays worth turning on. The header dot shows unread messages. *(inferred)* |
| Enter sends on a keyboard, never while a Korean syllable is being composed; on touch Enter is a new line | Enter always sends | Korean input commits a syllable on Enter; sending then cuts the last letter or sends twice. Phone keyboards have no Shift+Enter. |
| Inputs 16 px on phones; the sheet follows `visualViewport` | 14 px inputs, a fixed-height sheet | iOS zooms into smaller inputs, and the keyboard would cover a fixed sheet's composer. |
| The header changed: one language button and a chat button | Two "EN \| KO" buttons | To make room for the chat button on a phone's header without crowding it. |
| Others' text only through `textContent`; links built as nodes | `innerHTML` with escaping | Nothing typed by a member can run as code in a teammate's browser. |
