/** @jsx React.DOM */

var React = require('react');
var Message = require('Message.react');

var MessagePane = React.createClass({

  /**
   * @return {object}
   */
  getDefaultProps: function () {
    return {
      messages: []
    };
  },

  /**
   * @return {object}
   */
  render: function () {
    return (
      <section id="MessagePane">
        <ol id="messages">
          {this.props.messages.map(function (message) {
            return <Message />;
          })}
        </ol>
      </section>
    )
  }

});

module.exports = MessagePane;
