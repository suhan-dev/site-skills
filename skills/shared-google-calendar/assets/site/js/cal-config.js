// Calendar settings. Fill these once per project; every other calendar file reads them from here.
// The server has its own copy of the zone: `TZ` in lib/gcal.js. Keep the two the same.

// The team's time zone (IANA name, e.g. "Asia/Seoul"). "Today", the now line and every event time use it,
// wherever the viewer is.
export const TIMEZONE = "{{TIMEZONE}}";

// A calendar day runs from this hour to the same hour the next morning, so a late night stays on the day it started.
// 7 means 07:00 → 07:00. 0 gives an ordinary midnight-to-midnight day.
export const DAY_START_HOUR = 7;

// localStorage keys: <prefix>view (week | month) and <prefix>hidden (owner ids turned off in "Calendars")
export const PREF_PREFIX = "cal_";
