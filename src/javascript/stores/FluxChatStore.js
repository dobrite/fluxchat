var AppDispatcher = require('../dispatcher/AppDispatcher'),
    FluxChatConstants = require('../constants/FluxChatConstants'),
    EventEmitter = require('events').EventEmitter,
    merge = require('react/lib/merge');

var CHANGE_EVENT= 'change',
    pushstream,
    _messages = [];


_messages = {
  1: {
    id: 1,
    text: "YO!",
  },
  2: {
    id: 3,
    text: "Word up!",
  },
  3: {
    id: 3,
    text: "third",
  },
};

// 'private' functions

var initialize = function () {

  //Global for now TODO convert to commonJS
  PushStream.LOG_LEVEL = 'debug';

  pushstream = window.pushstream = new PushStream({
    host: window.location.hostname,
    port: 9080, //window.location.port,
    modes: "websocket|eventsource|stream"
  });

  pushstream.onmessage = manageEvent;
  pushstream.onstatuschange = statusChange;

};

var manageEvent = function (data, id, channel, eventid, isLastMessageFromBatch) {
  if (data === '') {
    return;
  }
  _messages[id] = JSON.parse(data);
  FluxChatStore.emitChange();
};

var statusChange = function (status) {
  console.log("sc", status);
};

var connect = function (channel) {
  pushstream.removeAllChannels();

  try {
    pushstream.addChannel(channel);
    pushstream.connect(channel);
  } catch (e) {
    alert(e);
  }

  console.log("connecting...");
};

var sendMessage = function (text) {

  var message = {
    text: text,
    nick: 'Nick'
  };

  //TODO can take a success and error callback
  //i.e. sendMessage(message, successCB, errorCB);
  pushstream.sendMessage(JSON.stringify(message));
};

var FluxChatStore = merge(EventEmitter.prototype, {

  // 'public' functions
  getAll: function () {
    return _messages;
  },

  emitChange: function () {
    this.emit(CHANGE_EVENT);
  }

});

AppDispatcher.register(function (payload) {
  var action = payload.action;

  switch (action.actionType) {
    case FluxChatConstants.PUSHSTREAM_INITIALIZE:
      initialize();
    break;

    case FluxChatConstants.PUSHSTREAM_CONNECT:
      connect(action.channel);
    break;

    case FluxChatConstants.CHAT_SEND_MESSAGE:
      sendMessage(action.message);
    break;

    default:
      return true;
  }

  FluxChatStore.emitChange();

  return true; // Needed by promises in Dispatcher
});

module.exports = FluxChatStore;
