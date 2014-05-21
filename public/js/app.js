/** @jsx React.DOM */

var React = window.React = require('react'); // for chrome dev tools

var FluxChat = require('./components/FluxChat.react');

React.renderComponent(
  <FluxChat />,
  document.getElementById('fluxchat')
);
