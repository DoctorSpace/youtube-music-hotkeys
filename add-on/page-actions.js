'use strict'
/* eslint-env chrome, webextensions */
/* exported ytmFindTab, ytmRun */

// Runs inside the music.youtube.com page (injected with chrome.scripting.executeScript),
// so it has to stay self-contained: no references to anything outside this function.
function ytmPageAction (action, value) {
  const qs = (q) => document.querySelector(q)
  const click = (el) => { if (el) el.click(); return !!el }
  const video = qs('video')
  const player = document.getElementById('movie_player')
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

  // movie_player is YouTube's own player API; fall back to the <video> element when a method is missing
  const hasApi = (name) => !!player && typeof player[name] === 'function'

  const getVolume = () => {
    const volume = hasApi('getVolume') ? player.getVolume() : NaN
    return Number.isFinite(volume) ? volume : Math.round(video.volume * 100)
  }
  const isMuted = () => hasApi('isMuted') ? !!player.isMuted() : video.muted
  const setMuted = (muted) => {
    if (hasApi('mute') && hasApi('unMute')) {
      if (muted) player.mute()
      else player.unMute()
    } else {
      video.muted = muted
    }
  }
  const setVolume = (percent) => {
    percent = clamp(Math.round(percent), 0, 100)
    if (percent > 0 && isMuted()) setMuted(false)
    if (hasApi('setVolume')) player.setVolume(percent)
    else video.volume = percent / 100
  }

  switch (action) {
    case 'rewind':
      return click(qs('.previous-button'))
    case 'forward':
      return click(qs('.next-button'))
    case 'play-pause':
      return click(qs('.play-pause-button'))
    case 'repeat':
      return click(qs('ytmusic-player-bar .repeat'))
    case 'shuffle':
      return click(qs('ytmusic-player-bar .shuffle'))
    case 'like':
      return click(qs('ytmusic-player-bar #button-shape-like button') ||
        qs('ytmusic-player-bar ytmusic-like-button-renderer #like'))
    case 'dislike':
      return click(qs('ytmusic-player-bar #button-shape-dislike button') ||
        qs('ytmusic-player-bar ytmusic-like-button-renderer #dislike'))

    case 'seek-to':
    case 'seek-by':
      if (!video) return false
      video.currentTime = clamp(action === 'seek-by' ? video.currentTime + value : value, 0, video.duration || 0)
      return true

    case 'mute':
      if (!video) return false
      setMuted(!isMuted())
      return true
    case 'volume-to':
    case 'volume-by':
      if (!video) return false
      setVolume(action === 'volume-by' ? getVolume() + value : value)
      return true

    case 'state': {
      const bar = qs('ytmusic-player-bar')
      const title = bar && bar.querySelector('.title')
      if (!video || !title || !title.textContent.trim()) return null

      const byline = bar.querySelector('.byline')
      const cover = bar.querySelector('img.image') || bar.querySelector('#thumbnail img')
      const like = bar.querySelector('ytmusic-like-button-renderer')
      return {
        title: title.textContent.trim(),
        artist: ((byline && (byline.title || byline.textContent)) || '').split('•')[0].trim(),
        cover: cover ? cover.src : '',
        paused: video.paused,
        current: video.currentTime || 0,
        duration: isFinite(video.duration) ? video.duration : 0,
        liked: !!like && like.getAttribute('like-status') === 'LIKE',
        volume: getVolume(),
        muted: isMuted()
      }
    }
  }
  return false
}

async function ytmFindTab () {
  const tabs = await chrome.tabs.query({ url: 'https://music.youtube.com/*' })
  return tabs.find((t) => t.audible) || tabs[0] || null
}

async function ytmRun (tabId, action, value) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: ytmPageAction,
    args: [action, value === undefined ? null : value]
  })
  return result && result.result
}
