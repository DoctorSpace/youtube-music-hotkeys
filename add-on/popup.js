'use strict'
/* eslint-env chrome, webextensions */
/* global ytmFindTab, ytmRun */

const $ = (id) => document.getElementById(id)

let tab = null
let duration = 0
let seeking = false
let changingVolume = false

function fmt (sec) {
  sec = Math.max(0, Math.floor(sec))
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
}

function show (name) {
  for (const id of ['closed', 'idle', 'error', 'player']) $(id).hidden = id !== name
}

function showError (err) {
  console.error('[YouTube Music Hotkeys]', err)
  $('error-details').textContent = err && err.message ? err.message : String(err)
  show('error')
}

function setSliderFill (slider, percent) {
  slider.style.setProperty('--pos', percent + '%')
}

function renderVolume (volume, muted) {
  const shown = muted ? 0 : volume
  if (!changingVolume) {
    $('volume-slider').value = shown
    setSliderFill($('volume-slider'), shown)
  }
  $('vol-waves').toggleAttribute('hidden', shown === 0)
  $('vol-muted').toggleAttribute('hidden', shown !== 0)
}

async function render () {
  try {
    tab = await ytmFindTab()
    if (!tab) return show('closed')

    const state = await ytmRun(tab.id, 'state')
    if (!state) return show('idle')
    draw(state)
  } catch (err) {
    showError(err)
  }
}

function draw (state) {
  show('player')
  $('title').textContent = state.title
  $('artist').textContent = state.artist
  if (state.cover && $('cover').src !== state.cover) $('cover').src = state.cover
  $('icon-play').toggleAttribute('hidden', !state.paused)
  $('icon-pause').toggleAttribute('hidden', state.paused)
  $('like-btn').classList.toggle('active', state.liked)

  duration = state.duration
  $('time-total').textContent = fmt(duration)
  $('seek').disabled = !duration
  if (!seeking) {
    const ratio = duration ? state.current / duration : 0
    $('seek').value = Math.round(ratio * 1000)
    setSliderFill($('seek'), ratio * 100)
    $('time-current').textContent = fmt(state.current)
  }

  renderVolume(state.volume, state.muted)
}

async function control (action, value) {
  if (!tab) return
  try {
    await ytmRun(tab.id, action, value)
  } catch (err) {
    return showError(err)
  }
  setTimeout(render, 200)
}

async function focusTab () {
  if (!tab) return
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
  window.close()
}

async function openPlayer () {
  await chrome.tabs.create({ pinned: true, url: 'https://music.youtube.com/' })
  window.close()
}

function openOptions () {
  chrome.runtime.openOptionsPage()
  window.close()
}

// seek bar: show the target time while dragging, jump when released
const seekEl = $('seek')
seekEl.addEventListener('input', () => {
  seeking = true
  setSliderFill(seekEl, seekEl.value / 10)
  $('time-current').textContent = fmt(seekEl.value / 1000 * duration)
})
seekEl.addEventListener('change', async () => {
  try {
    await ytmRun(tab.id, 'seek-to', seekEl.value / 1000 * duration)
  } catch (err) {
    showError(err)
  }
  seeking = false
})

// volume: slider under the speaker button, mouse wheel over the whole control
const volumeEl = $('volume-slider')
volumeEl.addEventListener('pointerdown', () => $('volume').classList.add('open'))
volumeEl.addEventListener('input', () => {
  const percent = Number(volumeEl.value)
  changingVolume = true
  setSliderFill(volumeEl, percent)
  renderVolume(percent, false)
  ytmRun(tab.id, 'volume-to', percent).catch(showError)
})
volumeEl.addEventListener('change', () => {
  changingVolume = false
  $('volume').classList.remove('open')
})
$('volume').addEventListener('wheel', (e) => {
  e.preventDefault()
  volumeEl.value = Number(volumeEl.value) + (e.deltaY < 0 ? 5 : -5)
  volumeEl.dispatchEvent(new Event('input'))
  volumeEl.dispatchEvent(new Event('change'))
}, { passive: false })

$('mute-btn').addEventListener('click', () => control('mute'))
$('play-btn').addEventListener('click', () => control('play-pause'))
$('prev-btn').addEventListener('click', () => control('rewind'))
$('next-btn').addEventListener('click', () => control('forward'))
$('like-btn').addEventListener('click', () => control('like'))
$('focus-btn').addEventListener('click', focusTab)
$('focus-btn-player').addEventListener('click', focusTab)
$('focus-btn-error').addEventListener('click', focusTab)
$('retry-btn').addEventListener('click', render)
$('open-btn').addEventListener('click', openPlayer)
$('open-link').addEventListener('click', (e) => { e.preventDefault(); openPlayer() })
$('options-btn').addEventListener('click', openOptions)
$('options-btn-closed').addEventListener('click', openOptions)

render()
setInterval(render, 1000)
