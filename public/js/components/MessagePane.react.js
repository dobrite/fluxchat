/** @jsx React.DOM */

var React = require('react');

var MessagePane = React.createClass({

  /**
   * @return {object}
   */
  render: function () {
    var messages = [];

    return (
      <section id="MessagePane">
        <ol id="messages">
          {messages}
        </ol>
      </section>
    )
  },

});

module.exports = MessagePane;
