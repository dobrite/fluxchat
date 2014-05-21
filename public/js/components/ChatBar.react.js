/** @jsx React.DOM */

var React = require('react');

var ChatBar = React.createClass({

  /**
   * @return {object}
   */
  render: function () {
    return (
      <form>
        <input type="text" />
        <input type="button" value="Say!" />
      </form>
    )
  },

});

module.exports = ChatBar;
