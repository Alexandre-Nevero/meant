export const BLOCKLISTS = {
  social: ['x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'reddit.com', 'linkedin.com', 'tiktok.com'],
  video: ['youtube.com', 'twitch.tv', 'netflix.com'],
  news: ['news.ycombinator.com', 'bbc.co.uk', 'cnn.com', 'theguardian.com'],
}

export const ALL_DOMAINS = Object.values(BLOCKLISTS).flat()
