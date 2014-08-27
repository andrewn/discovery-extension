/* jshint laxbreak: true, latedef: nofunc */
/*
  The following helper method are defined in
  playback-controls.js and search.js
*/
/* globals play, pause, nextTrack, previousTrack,
          setVolume, clearPlaylist, removeFromPlaylist,
          addToPlaylist, search
*/
'use strict';

chrome.runtime.getBackgroundPage(buildUI);

var view;

function buildUI(backgroundPage) {

  var serviceId = window.location.search.match(/service=([^&]*)/i)[1],
      services  = backgroundPage.services,
      radio     = services[serviceId],
      players   = radio.txt.players,
      currentPlayer = players[0];

  setupRadio(radio);
  players.forEach(function (player) {
    createAndAttachPlayer(player);
  });

  view = new Ractive({
    el: '#view',
    template: '#view-template',
    data: {
      currentPlayer: currentPlayer,
      players: players,
      streams: [],
      search: {
        term: '',
        results: []
      },
      volume: null
    },
    debug: true
  });

  view.observe('currentPlayer', function (newValue, oldValue, obj) {
    console.log('current', newValue, oldValue, obj);
    if (oldValue === undefined  || (newValue && newValue.id !== oldValue.id) ) {
      console.log('Swap global player', newValue, oldValue, obj);
      window.ui.player = newValue.player;
      view.set('search', { term: '', results: [] });
    }
  });

  view.observe('search.term', function (newValue) {
    console.log('search.term', newValue);
    search(newValue);
  });

  view.on('stream', function (evt) {
    evt.original.preventDefault();
    var url = evt.node.href;
    addToPlaylist(url).then(play);
  });

  view.on('next', function (evt) { nextTrack(); });
  view.on('previous', function (evt) { previousTrack(); });

  view.on('clear', function (evt) {
    clearPlaylist();
  });

  view.on('remove', function (evt) {
    var pos = evt.context.Pos;
    removeFromPlaylist(pos);
  });

  view.on('add-direct', function (evt) {
    var file = evt.context.file;
    if (file) {
      addToPlaylist(file);
      this.set('file', '');
    }
  });

  view.on('add', function (evt) {
    var file = evt.context.file;
    addToPlaylist(file);
  });

  view.observe('volume', function (newValue, oldValue) {
    console.log('ui volume changed', newValue, oldValue);
    var firstSetting = newValue === null || oldValue === null;
    // Only send updates if change is from UI
    if (!firstSetting) {
      console.log('send state update', newValue);
      setVolume(newValue);
    }
  });

  view.on('play-pause', function handlePlayPause(evt) {
    // Get the current button state
    var currentState = evt.context.currentPlayer.state;
    if (currentState === 'play') {
      pause();
    } else {
      play();
    }
  });

  document.addEventListener('searchresults', function (evt) {
    view.set('search.results', evt.results);
  });

  /*
   Live streams list
  */
  var streamsEl = document.querySelector('.streams');
  window.getJSON(
      'http://bbcradioservices.pixelblend.co.uk/services.json',
      buildServicesList
      );

  function buildServicesList(json) {
    view.set('streams', json.services);
  }
}

function setupRadio(service) {
  window.radio = window.Radiodan.create('http://'+service.address+':'+service.port);
}

function createAndAttachPlayer(playerSpec) {

  window.ui = window.ui || {};

  var player = window.radio.player.create(playerSpec.id)

  playerSpec.player = player;
  playerSpec.playlist = [];

  playerSpec.player.on('playlist', function (newPlaylist) {
    console.log('playlist', newPlaylist, playerSpec);
    var local = playerSpec.playlist;

    local.length = 0;
    playerSpec.playlist.push.apply(local, newPlaylist);
    view.update();
  });

  window.ui.audio  = window.radio.audio.create('default');

  // Get status to do an initial update of
  // the user interface
  player.status()
    .then(function (status) {
      console.log('player.status', status);

      if (status.playlist) {
        playerSpec.playlist = status.playlist;
      }
      
      if (status.player.state) {
        playerSpec.state = status.player.state;
      }

      if (status.player.song) {
        playerSpec.current = status.player.song;
      }

      if (status.player.nextsong) {
        playerSpec.next = status.player.nextsong;
      }

      console.log('update view');
      view.update();
    });

  /*
     Listen for general player state changes
     */
  player.on('player', function (info) {
    console.log('info', info);

    if (info.state) {
      playerSpec.state = info.state;
    }

    if (info.song) {
      playerSpec.current = info.song;
    }

    if (info.nextsong) {
      playerSpec.next = info.nextsong;
    }

    view.update();
  });

  window.ui.audio.status()
    .then(function (status) {
      var currentVolume = view.get('volume');
      console.log('audio.status', currentVolume, status);
      if (status.volume) {
        if (currentVolume !== status.volume) {
          view.set('volume', status.volume);
        }
      }
    });

  /*
     If the player volume is changed elsewhere in the
     system, change the position of the slider
     to match the new volume
     */
  window.ui.audio.on('volume', function(content) {
    console.log('Volume has changed to ', content.value);
    view.set('volume', content.value);
  });
}