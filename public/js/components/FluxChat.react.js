/** @jsx React.DOM */

var React = require('react');
var MessagePane = require('./MessagePane.react');
var ChatBar = require('./ChatBar.react');

var FluxChatActions = require('../actions/FluxChatActions');

var FluxChat = React.createClass({
  componentWillMount: function () {
    // sub to feed
  },

  //componentDidMount: function () {
  //  MessageStore.addChangeListener(this._onChange);
  //},

  //componentWillUnmount: function () {
  //  MessageStore.removeChangeListener(this._onChange);
  //},

  /**
   * @return {object}
   */
  render: function () {
    return (
      <div>
        <MessagePane />
        <ChatBar />
      </div>
    )
  },

  /**
   * Event handler for 'change' events coming from MessageStore
   */
  _onChange: function () {
    this.setState(getFluxChatState());
  }
});

module.exports = FluxChat;
