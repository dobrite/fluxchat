var AppDispatcher = require('../dispatcher/AppDispatcher');
var FluxChatConstants = require('../constants/FluxChatConstants');

var FluxChatActions = {

  /**
   * initializes pushstream
   */
  initialize: function () {
    AppDispatcher.handlePushAction({
      actionType: FluxChatConstants.PUSHSTREAM_INITIALIZE
    });
  },

  /**
   * connects via pushstream
   * @param {string} channel The channel name to connect to
   */
  connect: function (channel) {
    AppDispatcher.handlePushAction({
      actionType: FluxChatConstants.PUSHSTREAM_CONNECT,
      channel: channel
    });
  }

};

module.exports = FluxChatActions;
