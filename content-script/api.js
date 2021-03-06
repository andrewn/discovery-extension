/*
  The high-level mediascape API.
*/
window.mediascape = (function () {

  var instance = {};

  /*
    Calling `play(url)` injects a device selection
    UI into the page. If a user chooses a device
    then the stream is passed to that device.
    If the user closes the UI then the stream is not
    sent.

    Returns {Promise}
      Resolves: with the URL that has been played
      Rejects:  with an error if the user does not select a device
  */
  instance.play = function (url) {
    return new Promise(function (resolve, reject) {
      DeviceList.get()
        .then(function (devices) {
          var container = findOrCreateDeviceContainer(document.body);
          return createDeviceListUi(devices, container);
        })
        .then(function (device) {
          play(url, device);
          resolve(url);
        })
        .then(null, function (error) {
          if (error) { console.error(error); }
          reject(new Error('User did not give permission to play'));
        });
    });
  };

  /*
    Send a message requesting playback to the background
    page
  */
  function play(url, device) {
    chrome.runtime.sendMessage(
      { action: 'play', url: url, deviceName: device.serviceName },
      function(response) {
        console.log(response);
      }
    );
  }

  // Track whether a device list selection is in progress
  // We only allow one list to be open at a time.
  var deviceUiPromise;

  /*
    Creates a list of device services in
    the DOM element container provided.
    Returns a Promise
      Resolves: with a `device` spec if a device is selected
      Rejects:  if no device is selected and the UI is closed
  */
  function createDeviceListUi(services, container) {
    if (deviceUiPromise) {
      return Promise.reject(new Error('Play is already in progress - await user feedback'));
    }

    deviceUiPromise = new Promise(function (resolve, reject) {
      var html = '<h1 class="mediascape-hd">Send <span>to your radio</span></h1>';
      html += '<ul>';
      html += services.map(function (service, index) {
        return '<li class="mediascape-device-item" data-mediascape-service-index="' + index + '">'
                + '<a href="#">' + service.host + '</a>'
               '</li>';
      }).join('');
      html += '</ul>';
      html += '<a class="mediascape-close-btn" href="#">'
      html +=   '<img src="' + chrome.extension.getURL('shared/close-icon.svg') + '" alt="Close">'
      html += '</a>';
      container.innerHTML = html;

      // Show container
      Velocity(container, 'slideDown');

      container.addEventListener('click', function (evt) {
        var target = traverseParentsToFindTag( evt.target, 'LI' ),
            index;

        if (target) {
          index = target.getAttribute('data-mediascape-service-index');
        } else {
          target = traverseParentsToFindTag(evt.target, 'A');
        }

        // No device item or close button
        if (!target) {
          return;
        }

        if (index) {
          resolve(services[index]);
        } else {
          reject();
        }

        // Hide container
        Velocity(
          container,
          'slideUp',
          {
            complete: function (){
              deviceUiPromise = null;
              container.innerHTML = '';
            }
          }
        );
      })
    });

    return deviceUiPromise;
  };

  var deviceContainer;
  function findOrCreateDeviceContainer(root) {
    if (!deviceContainer) {
      deviceContainer = document.createElement('div');
      deviceContainer.className = 'mediascape-device-list mediascape-ui-panel';
      root.insertBefore(deviceContainer, root.firstChild);
    }

    return deviceContainer;
  }

  /*
    Helper - find ancestor DOM elemenets until
    tag matches
  */
  function traverseParentsToFindTag(node, tag) {
    if ( tag === node.nodeName ) {
      return node;
    } else if ( node.parentNode ) {
      return traverseParentsToFindTag( node.parentNode, tag );
    }
  }

  return instance;
})();
