/** @jsx React.DOM */

var React = require('react');
var FluxChatActions = require('../actions/FluxChatActions');

var ENTER_KEY_CODE = 13;

var ChatBar = React.createClass({

  getInitialState: function () {
    return {
      sayFormInputValue: ''
    };
  },

  /**
   * @return {object}
   */
  render: function () {
    return (
      <form className="say-form">
        <input
          className="say-form__input"
          type="text"
          value={this.state.sayFormInputValue}
          ref="sayFormInput"
          onKeyDown={this._onKeyDown}
          onChange={this._onChange}
        />
        <input
          className="say-form__button"
          type="button"
          value="Say!"
          onClick={this._onButtonClick}
        />
      </form>
    )
  },

  /**
   * Event handler to send chat message
   * by pressing enter
   * @param {object} event
   */
  _onKeyDown: function (event) {
    if (event.keyCode === ENTER_KEY_CODE) {
      event.preventDefault();
      FluxChatActions.sendMessage(event.target.value);
      this.setState({sayFormInputValue: ''});
    }
  },

  /**
   * Event handler to update input with
   * user input
   * @param {object} event
   */
  _onChange: function (event) {
    this.setState({sayFormInputValue: event.target.value});
  },

  /**
   * Event handler to send chat message
   * @param {object} event
   */
  _onButtonClick: function (event) {
    var value = this.refs['sayFormInput'].getDOMNode().value;
    FluxChatActions.sendMessage(value);
    this.setState({sayFormInputValue: ''});
  }

});

module.exports = ChatBar;
