'use strict'
/* eslint-env chrome, webextensions */

const $ = (id) => document.getElementById(id)

const groups = [
  { title: 'Воспроизведение', commands: ['toggle-playback', 'previous-song', 'next-song', 'seek-backward', 'seek-forward'] },
  { title: 'Звук', commands: ['volume-up', 'volume-down', 'toggle-mute'] },
  { title: 'Оценка и режимы', commands: ['like', 'dislike', 'toggle-repeat', 'toggle-shuffle'] },
  { title: 'Расширение и вкладка', commands: ['_execute_action', 'activate-tab', 'track-info'] }
]

function shortcutsUrl () {
  const ua = navigator.userAgent
  if (ua.includes('YaBrowser')) return 'browser://extensions/shortcuts'
  if (ua.includes('Edg/')) return 'edge://extensions/shortcuts'
  return 'chrome://extensions/shortcuts'
}

function buildRow (command) {
  const li = document.createElement('li')
  if (command.shortcut) li.className = 'assigned'

  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = command.description || (command.name === '_execute_action' ? 'Активация расширения' : command.name)

  const key = document.createElement('span')
  key.className = 'key' + (command.shortcut ? '' : ' empty')
  key.textContent = command.shortcut || 'Не задано'
  if (command.shortcut) key.title = command.shortcut

  li.append(name, key)
  return li
}

async function renderCommands () {
  const root = $('groups')
  root.textContent = ''
  const all = await chrome.commands.getAll()
  const byName = new Map(all.map((c) => [c.name, c]))

  const used = new Set()
  const sections = groups.map((g) => ({
    title: g.title,
    items: g.commands.map((n) => { used.add(n); return byName.get(n) }).filter(Boolean)
  }))
  const rest = all.filter((c) => !used.has(c.name))
  if (rest.length) sections.push({ title: 'Другие', items: rest })

  const columns = [document.createElement('div'), document.createElement('div')]
  columns.forEach((c) => { c.className = 'col'; root.append(c) })

  sections.forEach((section, i) => {
    if (!section.items.length) return
    const wrap = document.createElement('section')
    wrap.className = 'group'
    const title = document.createElement('h2')
    title.textContent = section.title
    const list = document.createElement('ul')
    list.className = 'commands'
    for (const command of section.items) list.append(buildRow(command))
    wrap.append(title, list)
    columns[i < 2 ? 0 : 1].append(wrap)
  })
}

async function openShortcuts () {
  const url = shortcutsUrl()
  try {
    await chrome.tabs.create({ url })
  } catch (err) {
    $('hint').textContent = 'Не удалось открыть страницу автоматически. Скопируйте адрес в строку браузера: ' + url
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('shortcuts-url').textContent = shortcutsUrl()
  $('open-shortcuts').addEventListener('click', openShortcuts)
  renderCommands()
})

// refresh when the user returns from the shortcuts page
window.addEventListener('focus', renderCommands)
