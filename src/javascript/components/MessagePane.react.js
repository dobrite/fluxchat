/** @jsx React.DOM */

var React = require('react');
var ReactPropTypes = React.PropTypes;
var Message = require('./Message.react');

var MessagePane = React.createClass({

  propTypes: {
    allMessages: ReactPropTypes.object.isRequired,
  },

  /**
   * @return {object}
   */
  render: function () {
    var allMessages = this.props.allMessages;
    var messages = [];

    for (var key in allMessages) {
      messages.push(<Message key={key} message={allMessages[key]} />);
    }

    return (
      <section>
        <ol>
          {messages}
        </ol>
      </section>
    )
  }

});

module.exports = MessagePane;
