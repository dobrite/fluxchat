/** @jsx React.DOM */

var React = require('react');

var Message = React.createClass({

  /**
   * @return {object}
   */
  render: function () {
    return (
      <li key={this.props.timestamp}>{this.props.message}</li>
    )
  }
});

module.exports = Message;
