var AppDispatcher = require('../dispatcher/AppDispatcher');
var FluxChatConstants = require('../constants/FluxChatConstants');

var FluxChatActions = {

  /**
   * subscribes to channel
   */
  subscribe: function () {
    AppDispatcher.handlePushAction({
      actionType: FluxChatConstants.CHANNEL_SUBSCRIBE
    });
  },
};

module.exports = FluxChatActions;
