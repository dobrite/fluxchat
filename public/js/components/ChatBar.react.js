/** @jsx React.DOM */

var React = require('react');

var FluxChatActions = require('../actions/FluxChatActions');

var ChatBar = React.createClass({

  /**
   * @return {object}
   */
  render: function () {
    return (
      <form>
        <input id="sayInput" type="text" />
        <input
          id="sayButton"
          type="button"
          value="Say!"
          onClick={this._onSayButtonClick}
        />
      </form>
    )
  },

  /**
   * Event handler to send chat message
   */
  _onSayButtonClick: function (event) {
    debugger
    console.log(event);
    FluxChatActions.sendMessage(event.target.value);
  }

});

module.exports = ChatBar;
