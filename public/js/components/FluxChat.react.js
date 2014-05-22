/** @jsx React.DOM */

var React = require('react');

var MessagePane = require('./MessagePane.react');
var ChatBar = require('./ChatBar.react');

var FluxChatActions = require('../actions/FluxChatActions');
var FluxChatStore = require('../stores/FluxChatStore');

var FluxChat = React.createClass({
  componentWillMount: function () {
    FluxChatActions.initialize();
    FluxChatActions.connect('example');
  },

  //pushstream.sendMessage('{"nick":"' + $("#nick").val() + '", "text":"' + $("#message").val().replace(/\r/g, '\\\\r').replace(/\n/g, '\\\\n') + '"}', onSendText);

  //componentDidMount: function () {
  //  FluxChatStore.addChangeListener(this._onChange);
  //},

  //componentWillUnmount: function () {
  //  FluxChatStore.removeChangeListener(this._onChange);
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
   * Event handler for 'change' events coming from FluxChatStore
   */
  //_onChange: function () {
  //  this.setState(getFluxChatState());
  //}
});

module.exports = FluxChat;
