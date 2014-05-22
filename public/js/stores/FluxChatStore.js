var AppDispatcher = require('../dispatcher/AppDispatcher');
var FluxChatConstants = require('../constants/FluxChatConstants');
var EventEmitter = require('events').EventEmitter;
var merge = require('react/lib/merge');

var CHANGE_EVENT= 'change';

var subscribe = function () {
  // Global for now
  PushStream.LOG_LEVEL = 'debug';
  var pushstream = new PushStream({
    host: window.location.hostname,
    port: window.location.port,
    modes: "websocket|eventsource|stream"
  });

  pushstream.onmessage = _manageEvent;
  pushstream.onstatuschange = _statusChanged;

};

var FluxChatStore = merge(EventEmitter.prototype, {
  emitChange: function () {
    this.emit(CHANGE_EVENT);
  }
});

AppDispatcher.register(function (payload) {
  var action = payload.action;

  switch(action.actionType) {
    case FluxChatConstants.CHANNEL_SUBSCRIBE:
      subscribe();
    break;

    default:
      return true;
  }

  FluxChatStore.emitChange();

  return true; // Needed by promises in Dispatcher
});

module.exports = FluxChatStore;
