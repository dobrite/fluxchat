var Dispatcher = require('./Dispatcher');
var merge = require('react/lib/merge');

var AppDispatcher = merge(Dispatcher.prototype, {

  /**
   * Handles all push actions
   * @param {object} action The data from the view
   */
  handlePushAction: function (action) {
    this.dispatch({
      source: 'PUSH_ACTION',
      action: action
    });
  },

  /**
   * Handles all view actions
   * @param {object} action The data from the view
   */
  handleViewAction: function (action) {
    this.dispatch({
      source: 'VIEW_ACTION',
      action: action
    });
  }

});

module.exports = AppDispatcher;
