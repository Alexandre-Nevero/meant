// design/canvas/explore/fixture.js
// One dataset, five artboards, so the comparison is about layout and not about data.
// Every field names the query that would produce it in Phase 2.
window.FIXTURE = {
  period: { label: 'September 2026', granularity: 'month' },

  // count(*) filter (where outcome=...) from session where started_at >= date_trunc('month', now())
  sessions: 23, finished: 14, notYet: 5, unanswered: 4,

  // sum(event.seconds) group by kind, joined to session on the period
  attentionSeconds: 148800,   // 41 hr 20 min
  awaySeconds: 22320,         // 6 hr 12 min
  breakSeconds: 7500,         // 2 hr 05 min
  unrecordedSeconds: 9180,    // lib/session-time.ts computeUnrecorded, summed

  // the same three, one month back, for the change row
  prev: { attentionSeconds: 129720, sessions: 19, finished: 11 },

  // count(*) from event where kind='block_hit'
  blockHits: 31,

  // sum(seconds) group by domain where kind='attention', joined to event.label (ADR-0062)
  domains: [
    { domain: 'docs.google.com',        seconds: 33120, label: 'work'     },
    { domain: 'claude.ai',              seconds: 27660, label: 'work'     },
    { domain: 'github.com',             seconds: 18180, label: 'work'     },
    { domain: 'figma.com',              seconds: 12480, label: 'work'     },
    { domain: 'mail.google.com',        seconds:  8100, label: 'neutral'  },
    { domain: 'twitter.com',            seconds:  6240, label: 'distract' },
    { domain: 'news.ycombinator.com',   seconds:  3720, label: 'distract' },
    { domain: 'linear.app',             seconds:  3060, label: 'work'     },
    { domain: 'youtube.com',            seconds:  2400, label: 'distract' },
    { domain: 'stackoverflow.com',      seconds:  1860, label: 'unknown'  },
  ],

  // sum(seconds) group by date(started_at), split by event.label. 30 entries, index 0 = Sep 1.
  // [work, neutral, distract, away] seconds per day. Zeros are weekends and are meant to be there.
  days: [
    [12600,1800,1200,2400],[14400,900,2700,1800],[9000,1200,600,1500],[0,0,0,0],[0,0,0,0],
    [16200,1500,900,2100],[13500,2100,1800,2700],[10800,900,3600,1200],[15300,1200,600,1800],[7200,600,1200,900],
    [0,0,0,0],[0,0,0,0],[14400,1800,900,2400],[12600,900,2400,1500],[16200,1200,600,3000],
    [9900,1500,1800,1200],[11700,600,900,2100],[0,0,0,0],[0,0,0,0],[13500,1200,1500,1800],
    [15300,900,600,2400],[10800,1800,2100,1500],[12600,1200,900,2700],[8100,600,1800,900],[0,0,0,0],
    [0,0,0,0],[14400,1500,1200,2100],[16200,900,600,1800],[11700,1200,2400,1500],[9000,600,900,1200],
  ],

  // count(*) group by started_at_local_hour (ADR-0067), finished vs not. 24 entries, index = hour.
  byHour: [
    [0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[1,0],[2,0],[4,1],[3,1],[2,1],
    [0,1],[1,0],[1,2],[0,1],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],
  ],

  // the five rows already on design/canvas/Ledger.dc.html, so the record is comparable
  // across the old artboard and all five new ones. a/b/c are band flex weights.
  rows: [
    { intention: 'finish the client proposal', outcome: 'Not yet',    started: 'Sep 18, 9:12',  minutes: 68, a: 41, b: 21, c: 6 },
    { intention: 'reply to the vendor thread', outcome: 'Yes',        started: 'Sep 18, 8:04',  minutes: 18, a: 14, b: 3,  c: 1 },
    { intention: 'read the Q3 brief properly', outcome: 'Yes',        started: 'Sep 17, 15:40', minutes: 33, a: 26, b: 5,  c: 2 },
    { intention: 'No intention given',         outcome: 'Unanswered', started: 'Sep 17, 11:22', minutes: 22, a: 8,  b: 6,  c: 8 },
    { intention: 'draft the handover notes',   outcome: 'Not yet',    started: 'Sep 16, 16:05', minutes: 27, a: 19, b: 4,  c: 4 },
  ],
};

// Shared formatters. Phase 2 reimplements these in lib/, typed.
window.hm = (s) => {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
};
window.pct = (n, d) => Math.round((n / d) * 100);
