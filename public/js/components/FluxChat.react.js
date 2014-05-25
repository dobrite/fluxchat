/** @jsx React.DOM */

var React = require('react');

var MessagePane = require('./MessagePane.react');
var ChatBar = require('./ChatBar.react');

var FluxChatActions = require('../actions/FluxChatActions');
var FluxChatStore = require('../stores/FluxChatStore');

var getFluxChatState = function () {
  return {
    allMessages: FluxChatStore.getAll()
  };
};

var FluxChat = React.createClass({

  getInitialState: function () {
    return getFluxChatState();
  },

  componentWillMount: function () {
    FluxChatActions.initialize();
    FluxChatActions.connect('example');
  },

  componentDidMount: function () {
    FluxChatStore.addListener('change', this._onChange);
  },

  componentWillUnmount: function () {
    FluxChatStore.removeListener('change', this._onChange);
  },

  /**
   * @return {object}
   */
  render: function () {
    return (
      <div>
        <MessagePane allMessages={this.state.allMessages} />
        <ChatBar />
      </div>
    )
  },

  /**
   * Event handler for 'change' events coming from FluxChatStore
   */
  _onChange: function () {
    this.setState(getFluxChatState());
  }
});

module.exports = FluxChat;
