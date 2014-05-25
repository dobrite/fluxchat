React = window.React = require 'react' # window for chrome dev tools
FluxChat = require './components/FluxChat.react'

React.renderComponent(FluxChat(), document.getElementById('fluxchat'))
