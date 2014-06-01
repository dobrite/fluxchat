# @cjsx React.DOM

React = require 'react'
ReactPropTypes = React.PropTypes

Message = React.createClass

  propTypes:
    message: ReactPropTypes.object.isRequired

  # @return {object}
  render: ->
    message = @props.message

    <li key={message.timestamp}>{message.timestamp} {message.text}</li>

module.exports = Message
