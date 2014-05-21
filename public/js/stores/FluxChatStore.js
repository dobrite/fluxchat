var AppDispatcher = require('../dispatcher/AppDispatcher');
var FluxChatConstants = require('../constants/FluxChatConstants');
var EventEmitter = require('events').EventEmitter;
var merge = require('react/lib/merge');

var subscribe = function () {

};

var FluxChatStore = merge(EventEmitter.prototype, {

});

module.exports = FluxChatStore;
