/*
 * Copyright 2014 Stefano Bagnatica <thepisu@gmail.com>
 * Copyright 2018 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  // Create media player component
  const player = Nuvola.$object(Nuvola.MediaPlayer)

  // Translations
  const C_ = Nuvola.Translate.pgettext

  // Custom actions
  const ACTION_THUMBS_UP = 'thumbs-up'
  const ACTION_THUMBS_DOWN = 'thumbs-down'

  // Handy aliases
  const PlaybackState = Nuvola.PlaybackState
  const PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  const WebApp = Nuvola.$WebApp()

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    const state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  WebApp._onInitAppRunner = function (emitter) {
    Nuvola.WebApp._onInitAppRunner.call(this, emitter)

    Nuvola.actions.addAction('playback', 'win', ACTION_THUMBS_UP, C_('Action', 'Thumbs up'),
      null, null, null, null)
    Nuvola.actions.addAction('playback', 'win', ACTION_THUMBS_DOWN, C_('Action', 'Thumbs down'),
      null, null, null, null)
  }

  // Page is ready for magic
  WebApp._onPageReady = function () {
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Jango does not support going to previous
    player.setCanGoPrev(false)

    // custom actions
    const actions = [ACTION_THUMBS_UP, ACTION_THUMBS_DOWN]
    player.addExtraActions(actions)

    // inizialize last thumb up / down variables
    this.lastThumbUp = null
    this.lastThumbDown = null
    this.volumeInitialized = false

    // Start update routine
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    // Default values
    let state = PlaybackState.UNKNOWN
    let albumArt = null
    let song = null
    let artist = null
    let album = null

    // Retrieve song details
    song = this.getCurrentSongName()

    if (song === null || song === 'Loading Music…') {
      // is still loading music... wait some more...
      setTimeout(this.update.bind(this), 250)
      return
    }

    // Retrieve playing status details
    state = this.isPlaying() ? PlaybackState.PLAYING : PlaybackState.PAUSED

    // Retrieve artist and album details
    let el = this.getJangoElement('player_current_artist')
    if (el != null) {
      const elLink = el.getElementsByTagName('a')
      if (elLink.length > 0) artist = elLink[0].textContent.trim()
      else artist = el.textContent.trim()

      // now album name is declared near the artist name
      if (el.childNodes.length > 4) album = el.childNodes[4].textContent
    }

    // I use current song image as album art
    el = this.getJangoElement('player_main_pic_img')
    if (el != null) albumArt = el.src

    const shuffle = this._getShuffleButton()

    // Update actions
    const actionsEnabled = {}
    actionsEnabled[PlayerAction.SHUFFLE] = !!shuffle
    actionsEnabled[ACTION_THUMBS_UP] = false
    actionsEnabled[ACTION_THUMBS_DOWN] = false
    switch (state) {
      case PlaybackState.PLAYING:
        player.setCanGoNext(true)
        player.setCanPause(true)
        player.setCanPlay(false)
        actionsEnabled[ACTION_THUMBS_UP] = true
        actionsEnabled[ACTION_THUMBS_DOWN] = true
        break
      case PlaybackState.PAUSED:
        player.setCanGoNext(true)
        player.setCanPause(false)
        player.setCanPlay(true)
        actionsEnabled[ACTION_THUMBS_UP] = true
        actionsEnabled[ACTION_THUMBS_DOWN] = true
        break
      default:
        player.setCanGoNext(false)
        player.setCanPause(false)
        player.setCanPlay(false)
    }
    Nuvola.actions.updateEnabledFlags(actionsEnabled)
    Nuvola.actions.updateState(PlayerAction.SHUFFLE, shuffle && shuffle.parentNode.classList.contains('on'))

    // set track info
    const track = {
      title: song,
      artist: artist,
      album: album,
      artLocation: albumArt
    }
    player.setTrack(track)

    // set playback state (playing / pause)
    player.setPlaybackState(state)

    const elms = this._getElements()
    if (elms.volumeBar) {
      // ~ elms.volumeBar.parentNode.parentNode.style.display = 'block'
      player.updateVolume(elms.volumeBar.style.left.split('%')[0] / 100)
      // ~ elms.volumeBar.parentNode.parentNode.style.display = 'none'
    }
    player.setCanChangeVolume(!!elms.volumeBar)

    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    switch (name) {
      /* Base media player actions */
      case PlayerAction.TOGGLE_PLAY:
      case PlayerAction.PLAY:
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        this.clickJangoButton('btn-playpause')
        break
      case PlayerAction.NEXT_SONG:
        this.clickJangoButton('btn-ff')
        break
      case PlayerAction.CHANGE_VOLUME: {
        const elms = this._getElements()
        elms.volumeIcon.style.display = 'none'
        elms.volumeBar.parentNode.parentNode.style.display = 'block'
        Nuvola.clickOnElement(elms.volumeBar.parentNode, param, 0.5)
        elms.volumeBar.parentNode.parentNode.style.display = 'none'
        elms.volumeIcon.style.display = 'block'
        break
      }
      case PlayerAction.SHUFFLE:
        Nuvola.clickOnElement(this._getShuffleButton())
        break
      /* Custom actions */
      case ACTION_THUMBS_UP:
        this.clickJangoButton('btn-fav')
        setTimeout(this.autoCommit.bind(this), 250)
        this.lastThumbUp = this.getCurrentSongName()
        break
      case ACTION_THUMBS_DOWN:
        this.clickJangoButton('player_ban')
        setTimeout(this.autoCommit.bind(this), 250)
        this.lastThumbDown = this.getCurrentSongName()
        break
    }
  }

  WebApp._getElements = function () {
    const elms = {
      volumeIcon: document.getElementById('volume_icon'),
      volumeBar: document.getElementById('volumeHandle')
    }
    if (elms.volumeIcon && elms.volumeBar && !this.volumeInitialized) {
      Nuvola.triggerMouseEvent(elms.volumeIcon, 'mouseover')
      Nuvola.triggerMouseEvent(elms.volumeBar, 'mouseout')
      elms.volumeBar.parentNode.parentNode.style.display = 'none'
      elms.volumeIcon.style.display = 'block'
      this.volumeInitialized = true
    }
    return elms
  }

  WebApp._getShuffleButton = function () {
    return document.querySelector('#action_shuffle a')
  }

  /**
   * Get DOM element by id, from the document of Jango content frame
   * @param id Element id
   */
  WebApp.getJangoElement = function (id) {
    return document.getElementById(id)
  }

  /**
   * Emulate click on an element in Jango content frame
   * @param id Element id
   */
  WebApp.clickJangoButton = function (id) {
    Nuvola.clickOnElement(this.getJangoElement(id))
  }

  /**
   * Find if Jango is playing, looking for button class name
   */
  WebApp.isPlaying = function () {
    const el = this.getJangoElement('btn-playpause')
    if (el == null) return false
    return (el.className === 'player_ctrls pause')
  }

  WebApp.getCurrentSongName = function () {
    const el = this.getJangoElement('current-song')
    if (el == null) return null
    return el.textContent.trim()
  }

  /**
   * Click automatically the commit button after thumb up / down
   * @param trycount Trying counter for button found
   */
  WebApp.autoCommit = function () {
    // find the commit button
    const els = document.getElementsByName('commit')
    if (els != null && els.length > 0) {
      const element = els[0]
      Nuvola.clickOnElement(element)
    } else {
      // the commit button could not be ready... retry for max 4 times
      if (this.trycount === undefined) this.trycount = 1
      if (this.trycount < 4) {
        setTimeout(this.autoCommit.bind(this), 250)
      }
    }
  }

  WebApp.start()
})(this) // function(Nuvola)
