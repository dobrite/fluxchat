/** @jsx React.DOM */

var React = require('react');
var ReactPropTypes = React.PropTypes;

var Message = React.createClass({

  propTypes: {
    message: ReactPropTypes.object.isRequired
  },

  /**
   * @return {object}
   */
  render: function () {
    var message = this.props.message;

    return (
      <li key={message.timestamp}>{message.timestamp} {message.text}</li>
    )
  }

});

module.exports = Message;
