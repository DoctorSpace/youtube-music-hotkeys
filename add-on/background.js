'use strict'
/* eslint-env chrome, webextensions */
/* global importScripts, ytmFindTab, ytmRun */

importScripts('page-actions.js')

const commandActions = {
  'toggle-playback': ['play-pause'],
  'previous-song': ['rewind'],
  'next-song': ['forward'],
  'toggle-repeat': ['repeat'],
  'toggle-shuffle': ['shuffle'],
  like: ['like'],
  dislike: ['dislike'],
  'seek-backward': ['seek-by', -10],
  'seek-forward': ['seek-by', 10],
  'toggle-mute': ['mute'],
  'volume-down': ['volume-by', -10],
  'volume-up': ['volume-by', 10]
}

async function showTrackInfo (tab) {
  const info = await ytmRun(tab.id, 'state')
  chrome.notifications.create({
    type: 'basic',
    iconUrl: (info && info.cover) || 'icon-128.png',
    title: info ? info.title : 'YouTube Music',
    message: info ? info.artist : 'Ничего не играет'
  })
}

async function executeCommand (command) {
  const tab = await ytmFindTab()
  if (!tab) return

  try {
    if (command === 'activate-tab') {
      await chrome.tabs.update(tab.id, { active: true })
      await chrome.windows.update(tab.windowId, { focused: true })
    } else if (command === 'track-info') {
      await showTrackInfo(tab)
    } else if (commandActions[command]) {
      await ytmRun(tab.id, ...commandActions[command])
    }
  } catch (err) {
    console.error('[YouTube Music Hotkeys] command failed:', command, err)
  }
}

// sent by autoplay.js
async function onRuntimeMessage (request, sender) {
  if (commandActions[request.command]) {
    await ytmRun(sender.tab.id, ...commandActions[request.command])
  }
}

chrome.commands.onCommand.addListener(executeCommand)
chrome.runtime.onMessage.addListener(onRuntimeMessage)
