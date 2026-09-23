export const BLOCKLISTS = {
  social: ['x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'reddit.com', 'linkedin.com', 'tiktok.com'],
  video: ['youtube.com', 'twitch.tv', 'netflix.com'],
  news: ['news.ycombinator.com', 'bbc.co.uk', 'cnn.com', 'theguardian.com'],
}

// ADR-0083. Provided, not built (T3): a rebuilding student pastes this file and never opens it.
// Key order is PRIORITY order — the first preset with a keyword in the intention wins.
// `describe` is what the fallback classifier reads (lib/preset-classify.ts); `keywords` are
// single lowercase words, matched whole. `allow` wins over `block` and over the user's own list.
export const PRESETS = {
  writing: {
    label: 'Writing',
    describe: 'producing text: drafting, editing, letters, essays, reports, articles, posts',
    keywords: ['write', 'writing', 'draft', 'drafting', 'letter', 'essay', 'article', 'blog', 'copy', 'copywriting', 'edit', 'editing', 'proofread', 'report', 'proposal', 'chapter', 'script', 'newsletter'],
    block: [...BLOCKLISTS.social, ...BLOCKLISTS.video, ...BLOCKLISTS.news],
    allow: [],
  },
  research: {
    label: 'Research',
    describe: 'finding and reading sources to answer a question',
    keywords: ['research', 'researching', 'sources', 'investigate', 'investigating', 'literature', 'read', 'reading'],
    block: [...BLOCKLISTS.social, ...BLOCKLISTS.news, 'twitch.tv', 'netflix.com'],
    allow: ['youtube.com'],
  },
  study: {
    label: 'Study',
    describe: 'learning for a course or an exam: lectures, homework, revision',
    keywords: ['study', 'studying', 'exam', 'exams', 'homework', 'revise', 'revision', 'lecture', 'course', 'coursework', 'assignment', 'learn', 'learning', 'flashcards'],
    block: [...BLOCKLISTS.social, ...BLOCKLISTS.news, 'twitch.tv', 'netflix.com'],
    allow: ['youtube.com'],
  },
  admin: {
    label: 'Admin',
    describe: 'email, invoices, scheduling and other upkeep',
    keywords: ['email', 'emails', 'inbox', 'invoice', 'invoices', 'admin', 'reply', 'replies', 'schedule', 'scheduling', 'bookkeeping', 'expenses', 'taxes', 'calendar'],
    block: [...BLOCKLISTS.social, ...BLOCKLISTS.video, ...BLOCKLISTS.news],
    allow: [],
  },
}
