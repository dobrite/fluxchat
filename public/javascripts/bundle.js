(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.once = noop;
process.off = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],3:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/main";
"use strict";
var Promise = require("./promise/promise").Promise;
var polyfill = require("./promise/polyfill").polyfill;
exports.Promise = Promise;
exports.polyfill = polyfill;


},{"./promise/polyfill":8,"./promise/promise":9}],4:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/all";
"use strict";
var isArray = require("./utils").isArray;
var isFunction = require("./utils").isFunction;
function all(promises) {
  var Promise = this;
  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to all.');
  }
  return new Promise(function(resolve, reject) {
    var results = [],
        remaining = promises.length,
        promise;
    if (remaining === 0) {
      resolve([]);
    }
    function resolver(index) {
      return function(value) {
        resolveAll(index, value);
      };
    }
    function resolveAll(index, value) {
      results[index] = value;
      if (--remaining === 0) {
        resolve(results);
      }
    }
    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];
      if (promise && isFunction(promise.then)) {
        promise.then(resolver(i), reject);
      } else {
        resolveAll(i, promise);
      }
    }
  });
}
exports.all = all;


},{"./utils":13}],5:[function(require,module,exports){
(function (process,global){
module.exports = function() {
  "use strict";
  var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/asap";
  "use strict";
  var browserGlobal = (typeof window !== 'undefined') ? window : {};
  var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
  var local = (typeof global !== 'undefined') ? global : (this === undefined ? window : this);
  function useNextTick() {
    return function() {
      process.nextTick(flush);
    };
  }
  function useMutationObserver() {
    var iterations = 0;
    var observer = new BrowserMutationObserver(flush);
    var node = document.createTextNode('');
    observer.observe(node, {characterData: true});
    return function() {
      node.data = (iterations = ++iterations % 2);
    };
  }
  function useSetTimeout() {
    return function() {
      local.setTimeout(flush, 1);
    };
  }
  var queue = [];
  function flush() {
    for (var i = 0; i < queue.length; i++) {
      var tuple = queue[i];
      var callback = tuple[0],
          arg = tuple[1];
      callback(arg);
    }
    queue = [];
  }
  var scheduleFlush;
  if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
    scheduleFlush = useNextTick();
  } else if (BrowserMutationObserver) {
    scheduleFlush = useMutationObserver();
  } else {
    scheduleFlush = useSetTimeout();
  }
  function asap(callback, arg) {
    var length = queue.push([callback, arg]);
    if (length === 1) {
      scheduleFlush();
    }
  }
  exports.asap = asap;
  return {};
}.call(typeof global !== 'undefined' ? global : this);


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],6:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/cast";
"use strict";
function cast(object) {
  if (object && typeof object === 'object' && object.constructor === this) {
    return object;
  }
  var Promise = this;
  return new Promise(function(resolve) {
    resolve(object);
  });
}
exports.cast = cast;


},{}],7:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/config";
"use strict";
var config = {instrument: false};
function configure(name, value) {
  if (arguments.length === 2) {
    config[name] = value;
  } else {
    return config[name];
  }
}
exports.config = config;
exports.configure = configure;


},{}],8:[function(require,module,exports){
(function (global){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/polyfill";
"use strict";
var RSVPPromise = require("./promise").Promise;
var isFunction = require("./utils").isFunction;
function polyfill() {
  var local;
  if (typeof global !== 'undefined') {
    local = global;
  } else if (typeof window !== 'undefined' && window.document) {
    local = window;
  } else {
    local = self;
  }
  var es6PromiseSupport = "Promise" in local && "cast" in local.Promise && "resolve" in local.Promise && "reject" in local.Promise && "all" in local.Promise && "race" in local.Promise && (function() {
    var resolve;
    new local.Promise(function(r) {
      resolve = r;
    });
    return isFunction(resolve);
  }());
  if (!es6PromiseSupport) {
    local.Promise = RSVPPromise;
  }
}
exports.polyfill = polyfill;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./promise":9,"./utils":13}],9:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/promise";
"use strict";
var config = require("./config").config;
var configure = require("./config").configure;
var objectOrFunction = require("./utils").objectOrFunction;
var isFunction = require("./utils").isFunction;
var now = require("./utils").now;
var cast = require("./cast").cast;
var all = require("./all").all;
var race = require("./race").race;
var staticResolve = require("./resolve").resolve;
var staticReject = require("./reject").reject;
var asap = require("./asap").asap;
var counter = 0;
config.async = asap;
function Promise(resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
  }
  if (!(this instanceof Promise)) {
    throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
  }
  this._subscribers = [];
  invokeResolver(resolver, this);
}
function invokeResolver(resolver, promise) {
  function resolvePromise(value) {
    resolve(promise, value);
  }
  function rejectPromise(reason) {
    reject(promise, reason);
  }
  try {
    resolver(resolvePromise, rejectPromise);
  } catch (e) {
    rejectPromise(e);
  }
}
function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value,
      error,
      succeeded,
      failed;
  if (hasCallback) {
    try {
      value = callback(detail);
      succeeded = true;
    } catch (e) {
      failed = true;
      error = e;
    }
  } else {
    value = detail;
    succeeded = true;
  }
  if (handleThenable(promise, value)) {
    return;
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (failed) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    resolve(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}
var PENDING = void 0;
var SEALED = 0;
var FULFILLED = 1;
var REJECTED = 2;
function subscribe(parent, child, onFulfillment, onRejection) {
  var subscribers = parent._subscribers;
  var length = subscribers.length;
  subscribers[length] = child;
  subscribers[length + FULFILLED] = onFulfillment;
  subscribers[length + REJECTED] = onRejection;
}
function publish(promise, settled) {
  var child,
      callback,
      subscribers = promise._subscribers,
      detail = promise._detail;
  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];
    invokeCallback(settled, child, callback, detail);
  }
  promise._subscribers = null;
}
Promise.prototype = {
  constructor: Promise,
  _state: undefined,
  _detail: undefined,
  _subscribers: undefined,
  then: function(onFulfillment, onRejection) {
    var promise = this;
    var thenPromise = new this.constructor(function() {});
    if (this._state) {
      var callbacks = arguments;
      config.async(function invokePromiseCallback() {
        invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
      });
    } else {
      subscribe(this, thenPromise, onFulfillment, onRejection);
    }
    return thenPromise;
  },
  'catch': function(onRejection) {
    return this.then(null, onRejection);
  }
};
Promise.all = all;
Promise.cast = cast;
Promise.race = race;
Promise.resolve = staticResolve;
Promise.reject = staticReject;
function handleThenable(promise, value) {
  var then = null,
      resolved;
  try {
    if (promise === value) {
      throw new TypeError("A promises callback cannot return that same promise.");
    }
    if (objectOrFunction(value)) {
      then = value.then;
      if (isFunction(then)) {
        then.call(value, function(val) {
          if (resolved) {
            return true;
          }
          resolved = true;
          if (value !== val) {
            resolve(promise, val);
          } else {
            fulfill(promise, val);
          }
        }, function(val) {
          if (resolved) {
            return true;
          }
          resolved = true;
          reject(promise, val);
        });
        return true;
      }
    }
  } catch (error) {
    if (resolved) {
      return true;
    }
    reject(promise, error);
    return true;
  }
  return false;
}
function resolve(promise, value) {
  if (promise === value) {
    fulfill(promise, value);
  } else if (!handleThenable(promise, value)) {
    fulfill(promise, value);
  }
}
function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = SEALED;
  promise._detail = value;
  config.async(publishFulfillment, promise);
}
function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = SEALED;
  promise._detail = reason;
  config.async(publishRejection, promise);
}
function publishFulfillment(promise) {
  publish(promise, promise._state = FULFILLED);
}
function publishRejection(promise) {
  publish(promise, promise._state = REJECTED);
}
exports.Promise = Promise;


},{"./all":4,"./asap":5,"./cast":6,"./config":7,"./race":10,"./reject":11,"./resolve":12,"./utils":13}],10:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/race";
"use strict";
var isArray = require("./utils").isArray;
function race(promises) {
  var Promise = this;
  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to race.');
  }
  return new Promise(function(resolve, reject) {
    var results = [],
        promise;
    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];
      if (promise && typeof promise.then === 'function') {
        promise.then(resolve, reject);
      } else {
        resolve(promise);
      }
    }
  });
}
exports.race = race;


},{"./utils":13}],11:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/reject";
"use strict";
function reject(reason) {
  var Promise = this;
  return new Promise(function(resolve, reject) {
    reject(reason);
  });
}
exports.reject = reject;


},{}],12:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/resolve";
"use strict";
function resolve(value) {
  var Promise = this;
  return new Promise(function(resolve, reject) {
    resolve(value);
  });
}
exports.resolve = resolve;


},{}],13:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/es6-promise/dist/commonjs/promise/utils";
"use strict";
function objectOrFunction(x) {
  return isFunction(x) || (typeof x === "object" && x !== null);
}
function isFunction(x) {
  return typeof x === "function";
}
function isArray(x) {
  return Object.prototype.toString.call(x) === "[object Array]";
}
var now = Date.now || function() {
  return new Date().getTime();
};
exports.objectOrFunction = objectOrFunction;
exports.isFunction = isFunction;
exports.isArray = isArray;
exports.now = now;


},{}],14:[function(require,module,exports){
(function (process,global){
(function(global) {
  'use strict';
  if (global.$traceurRuntime) {
    return;
  }
  var $Object = Object;
  var $TypeError = TypeError;
  var $create = $Object.create;
  var $defineProperties = $Object.defineProperties;
  var $defineProperty = $Object.defineProperty;
  var $freeze = $Object.freeze;
  var $getOwnPropertyDescriptor = $Object.getOwnPropertyDescriptor;
  var $getOwnPropertyNames = $Object.getOwnPropertyNames;
  var $getPrototypeOf = $Object.getPrototypeOf;
  var $hasOwnProperty = $Object.prototype.hasOwnProperty;
  var $toString = $Object.prototype.toString;
  function nonEnum(value) {
    return {
      configurable: true,
      enumerable: false,
      value: value,
      writable: true
    };
  }
  var types = {
    void: function voidType() {},
    any: function any() {},
    string: function string() {},
    number: function number() {},
    boolean: function boolean() {}
  };
  var method = nonEnum;
  var counter = 0;
  function newUniqueString() {
    return '__$' + Math.floor(Math.random() * 1e9) + '$' + ++counter + '$__';
  }
  var symbolInternalProperty = newUniqueString();
  var symbolDescriptionProperty = newUniqueString();
  var symbolDataProperty = newUniqueString();
  var symbolValues = $create(null);
  function isSymbol(symbol) {
    return typeof symbol === 'object' && symbol instanceof SymbolValue;
  }
  function typeOf(v) {
    if (isSymbol(v))
      return 'symbol';
    return typeof v;
  }
  function Symbol(description) {
    var value = new SymbolValue(description);
    if (!(this instanceof Symbol))
      return value;
    throw new TypeError('Symbol cannot be new\'ed');
  }
  $defineProperty(Symbol.prototype, 'constructor', nonEnum(Symbol));
  $defineProperty(Symbol.prototype, 'toString', method(function() {
    var symbolValue = this[symbolDataProperty];
    if (!getOption('symbols'))
      return symbolValue[symbolInternalProperty];
    if (!symbolValue)
      throw TypeError('Conversion from symbol to string');
    var desc = symbolValue[symbolDescriptionProperty];
    if (desc === undefined)
      desc = '';
    return 'Symbol(' + desc + ')';
  }));
  $defineProperty(Symbol.prototype, 'valueOf', method(function() {
    var symbolValue = this[symbolDataProperty];
    if (!symbolValue)
      throw TypeError('Conversion from symbol to string');
    if (!getOption('symbols'))
      return symbolValue[symbolInternalProperty];
    return symbolValue;
  }));
  function SymbolValue(description) {
    var key = newUniqueString();
    $defineProperty(this, symbolDataProperty, {value: this});
    $defineProperty(this, symbolInternalProperty, {value: key});
    $defineProperty(this, symbolDescriptionProperty, {value: description});
    $freeze(this);
    symbolValues[key] = this;
  }
  $defineProperty(SymbolValue.prototype, 'constructor', nonEnum(Symbol));
  $defineProperty(SymbolValue.prototype, 'toString', {
    value: Symbol.prototype.toString,
    enumerable: false
  });
  $defineProperty(SymbolValue.prototype, 'valueOf', {
    value: Symbol.prototype.valueOf,
    enumerable: false
  });
  $freeze(SymbolValue.prototype);
  Symbol.iterator = Symbol();
  function toProperty(name) {
    if (isSymbol(name))
      return name[symbolInternalProperty];
    return name;
  }
  function getOwnPropertyNames(object) {
    var rv = [];
    var names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (!symbolValues[name])
        rv.push(name);
    }
    return rv;
  }
  function getOwnPropertyDescriptor(object, name) {
    return $getOwnPropertyDescriptor(object, toProperty(name));
  }
  function getOwnPropertySymbols(object) {
    var rv = [];
    var names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var symbol = symbolValues[names[i]];
      if (symbol)
        rv.push(symbol);
    }
    return rv;
  }
  function hasOwnProperty(name) {
    return $hasOwnProperty.call(this, toProperty(name));
  }
  function getOption(name) {
    return global.traceur && global.traceur.options[name];
  }
  function setProperty(object, name, value) {
    var sym,
        desc;
    if (isSymbol(name)) {
      sym = name;
      name = name[symbolInternalProperty];
    }
    object[name] = value;
    if (sym && (desc = $getOwnPropertyDescriptor(object, name)))
      $defineProperty(object, name, {enumerable: false});
    return value;
  }
  function defineProperty(object, name, descriptor) {
    if (isSymbol(name)) {
      if (descriptor.enumerable) {
        descriptor = $create(descriptor, {enumerable: {value: false}});
      }
      name = name[symbolInternalProperty];
    }
    $defineProperty(object, name, descriptor);
    return object;
  }
  function polyfillObject(Object) {
    $defineProperty(Object, 'defineProperty', {value: defineProperty});
    $defineProperty(Object, 'getOwnPropertyNames', {value: getOwnPropertyNames});
    $defineProperty(Object, 'getOwnPropertyDescriptor', {value: getOwnPropertyDescriptor});
    $defineProperty(Object.prototype, 'hasOwnProperty', {value: hasOwnProperty});
    Object.getOwnPropertySymbols = getOwnPropertySymbols;
    function is(left, right) {
      if (left === right)
        return left !== 0 || 1 / left === 1 / right;
      return left !== left && right !== right;
    }
    $defineProperty(Object, 'is', method(is));
    function assign(target, source) {
      var props = $getOwnPropertyNames(source);
      var p,
          length = props.length;
      for (p = 0; p < length; p++) {
        target[props[p]] = source[props[p]];
      }
      return target;
    }
    $defineProperty(Object, 'assign', method(assign));
    function mixin(target, source) {
      var props = $getOwnPropertyNames(source);
      var p,
          descriptor,
          length = props.length;
      for (p = 0; p < length; p++) {
        descriptor = $getOwnPropertyDescriptor(source, props[p]);
        $defineProperty(target, props[p], descriptor);
      }
      return target;
    }
    $defineProperty(Object, 'mixin', method(mixin));
  }
  function exportStar(object) {
    for (var i = 1; i < arguments.length; i++) {
      var names = $getOwnPropertyNames(arguments[i]);
      for (var j = 0; j < names.length; j++) {
        (function(mod, name) {
          $defineProperty(object, name, {
            get: function() {
              return mod[name];
            },
            enumerable: true
          });
        })(arguments[i], names[j]);
      }
    }
    return object;
  }
  function toObject(value) {
    if (value == null)
      throw $TypeError();
    return $Object(value);
  }
  function spread() {
    var rv = [],
        k = 0;
    for (var i = 0; i < arguments.length; i++) {
      var valueToSpread = toObject(arguments[i]);
      for (var j = 0; j < valueToSpread.length; j++) {
        rv[k++] = valueToSpread[j];
      }
    }
    return rv;
  }
  function getPropertyDescriptor(object, name) {
    while (object !== null) {
      var result = $getOwnPropertyDescriptor(object, name);
      if (result)
        return result;
      object = $getPrototypeOf(object);
    }
    return undefined;
  }
  function superDescriptor(homeObject, name) {
    var proto = $getPrototypeOf(homeObject);
    if (!proto)
      throw $TypeError('super is null');
    return getPropertyDescriptor(proto, name);
  }
  function superCall(self, homeObject, name, args) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor) {
      if ('value' in descriptor)
        return descriptor.value.apply(self, args);
      if (descriptor.get)
        return descriptor.get.call(self).apply(self, args);
    }
    throw $TypeError("super has no method '" + name + "'.");
  }
  function superGet(self, homeObject, name) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor) {
      if (descriptor.get)
        return descriptor.get.call(self);
      else if ('value' in descriptor)
        return descriptor.value;
    }
    return undefined;
  }
  function superSet(self, homeObject, name, value) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor && descriptor.set) {
      descriptor.set.call(self, value);
      return value;
    }
    throw $TypeError("super has no setter '" + name + "'.");
  }
  function getDescriptors(object) {
    var descriptors = {},
        name,
        names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      descriptors[name] = $getOwnPropertyDescriptor(object, name);
    }
    return descriptors;
  }
  function createClass(ctor, object, staticObject, superClass) {
    $defineProperty(object, 'constructor', {
      value: ctor,
      configurable: true,
      enumerable: false,
      writable: true
    });
    if (arguments.length > 3) {
      if (typeof superClass === 'function')
        ctor.__proto__ = superClass;
      ctor.prototype = $create(getProtoParent(superClass), getDescriptors(object));
    } else {
      ctor.prototype = object;
    }
    $defineProperty(ctor, 'prototype', {
      configurable: false,
      writable: false
    });
    return $defineProperties(ctor, getDescriptors(staticObject));
  }
  function getProtoParent(superClass) {
    if (typeof superClass === 'function') {
      var prototype = superClass.prototype;
      if ($Object(prototype) === prototype || prototype === null)
        return superClass.prototype;
    }
    if (superClass === null)
      return null;
    throw new TypeError();
  }
  function defaultSuperCall(self, homeObject, args) {
    if ($getPrototypeOf(homeObject) !== null)
      superCall(self, homeObject, 'constructor', args);
  }
  var ST_NEWBORN = 0;
  var ST_EXECUTING = 1;
  var ST_SUSPENDED = 2;
  var ST_CLOSED = 3;
  var END_STATE = -2;
  var RETHROW_STATE = -3;
  function addIterator(object) {
    return defineProperty(object, Symbol.iterator, nonEnum(function() {
      return this;
    }));
  }
  function getInternalError(state) {
    return new Error('Traceur compiler bug: invalid state in state machine: ' + state);
  }
  function GeneratorContext() {
    this.state = 0;
    this.GState = ST_NEWBORN;
    this.storedException = undefined;
    this.finallyFallThrough = undefined;
    this.sent_ = undefined;
    this.returnValue = undefined;
    this.tryStack_ = [];
  }
  GeneratorContext.prototype = {
    pushTry: function(catchState, finallyState) {
      if (finallyState !== null) {
        var finallyFallThrough = null;
        for (var i = this.tryStack_.length - 1; i >= 0; i--) {
          if (this.tryStack_[i].catch !== undefined) {
            finallyFallThrough = this.tryStack_[i].catch;
            break;
          }
        }
        if (finallyFallThrough === null)
          finallyFallThrough = RETHROW_STATE;
        this.tryStack_.push({
          finally: finallyState,
          finallyFallThrough: finallyFallThrough
        });
      }
      if (catchState !== null) {
        this.tryStack_.push({catch: catchState});
      }
    },
    popTry: function() {
      this.tryStack_.pop();
    },
    get sent() {
      this.maybeThrow();
      return this.sent_;
    },
    set sent(v) {
      this.sent_ = v;
    },
    get sentIgnoreThrow() {
      return this.sent_;
    },
    maybeThrow: function() {
      if (this.action === 'throw') {
        this.action = 'next';
        throw this.sent_;
      }
    },
    end: function() {
      switch (this.state) {
        case END_STATE:
          return this;
        case RETHROW_STATE:
          throw this.storedException;
        default:
          throw getInternalError(this.state);
      }
    }
  };
  function getNextOrThrow(ctx, moveNext, action) {
    return function(x) {
      switch (ctx.GState) {
        case ST_EXECUTING:
          throw new Error(("\"" + action + "\" on executing generator"));
        case ST_CLOSED:
          throw new Error(("\"" + action + "\" on closed generator"));
        case ST_NEWBORN:
          if (action === 'throw') {
            ctx.GState = ST_CLOSED;
            throw x;
          }
          if (x !== undefined)
            throw $TypeError('Sent value to newborn generator');
        case ST_SUSPENDED:
          ctx.GState = ST_EXECUTING;
          ctx.action = action;
          ctx.sent = x;
          var value = moveNext(ctx);
          var done = value === ctx;
          if (done)
            value = ctx.returnValue;
          ctx.GState = done ? ST_CLOSED : ST_SUSPENDED;
          return {
            value: value,
            done: done
          };
      }
    };
  }
  function generatorWrap(innerFunction, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new GeneratorContext();
    return addIterator({
      next: getNextOrThrow(ctx, moveNext, 'next'),
      throw: getNextOrThrow(ctx, moveNext, 'throw')
    });
  }
  function AsyncFunctionContext() {
    GeneratorContext.call(this);
    this.err = undefined;
    var ctx = this;
    ctx.result = new Promise(function(resolve, reject) {
      ctx.resolve = resolve;
      ctx.reject = reject;
    });
  }
  AsyncFunctionContext.prototype = Object.create(GeneratorContext.prototype);
  AsyncFunctionContext.prototype.end = function() {
    switch (this.state) {
      case END_STATE:
        return;
      case RETHROW_STATE:
        this.reject(this.storedException);
      default:
        this.reject(getInternalError(this.state));
    }
  };
  function asyncWrap(innerFunction, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new AsyncFunctionContext();
    ctx.createCallback = function(newState) {
      return function(value) {
        ctx.state = newState;
        ctx.value = value;
        moveNext(ctx);
      };
    };
    ctx.createErrback = function(newState) {
      return function(err) {
        ctx.state = newState;
        ctx.err = err;
        moveNext(ctx);
      };
    };
    moveNext(ctx);
    return ctx.result;
  }
  function getMoveNext(innerFunction, self) {
    return function(ctx) {
      while (true) {
        try {
          return innerFunction.call(self, ctx);
        } catch (ex) {
          ctx.storedException = ex;
          var last = ctx.tryStack_[ctx.tryStack_.length - 1];
          if (!last) {
            ctx.GState = ST_CLOSED;
            ctx.state = END_STATE;
            throw ex;
          }
          ctx.state = last.catch !== undefined ? last.catch : last.finally;
          if (last.finallyFallThrough !== undefined)
            ctx.finallyFallThrough = last.finallyFallThrough;
        }
      }
    };
  }
  function setupGlobals(global) {
    global.Symbol = Symbol;
    polyfillObject(global.Object);
  }
  setupGlobals(global);
  global.$traceurRuntime = {
    asyncWrap: asyncWrap,
    createClass: createClass,
    defaultSuperCall: defaultSuperCall,
    exportStar: exportStar,
    generatorWrap: generatorWrap,
    setProperty: setProperty,
    setupGlobals: setupGlobals,
    spread: spread,
    superCall: superCall,
    superGet: superGet,
    superSet: superSet,
    toObject: toObject,
    toProperty: toProperty,
    type: types,
    typeof: typeOf
  };
})(typeof global !== 'undefined' ? global : this);
(function() {
  function buildFromEncodedParts(opt_scheme, opt_userInfo, opt_domain, opt_port, opt_path, opt_queryData, opt_fragment) {
    var out = [];
    if (opt_scheme) {
      out.push(opt_scheme, ':');
    }
    if (opt_domain) {
      out.push('//');
      if (opt_userInfo) {
        out.push(opt_userInfo, '@');
      }
      out.push(opt_domain);
      if (opt_port) {
        out.push(':', opt_port);
      }
    }
    if (opt_path) {
      out.push(opt_path);
    }
    if (opt_queryData) {
      out.push('?', opt_queryData);
    }
    if (opt_fragment) {
      out.push('#', opt_fragment);
    }
    return out.join('');
  }
  ;
  var splitRe = new RegExp('^' + '(?:' + '([^:/?#.]+)' + ':)?' + '(?://' + '(?:([^/?#]*)@)?' + '([\\w\\d\\-\\u0100-\\uffff.%]*)' + '(?::([0-9]+))?' + ')?' + '([^?#]+)?' + '(?:\\?([^#]*))?' + '(?:#(.*))?' + '$');
  var ComponentIndex = {
    SCHEME: 1,
    USER_INFO: 2,
    DOMAIN: 3,
    PORT: 4,
    PATH: 5,
    QUERY_DATA: 6,
    FRAGMENT: 7
  };
  function split(uri) {
    return (uri.match(splitRe));
  }
  function removeDotSegments(path) {
    if (path === '/')
      return '/';
    var leadingSlash = path[0] === '/' ? '/' : '';
    var trailingSlash = path.slice(-1) === '/' ? '/' : '';
    var segments = path.split('/');
    var out = [];
    var up = 0;
    for (var pos = 0; pos < segments.length; pos++) {
      var segment = segments[pos];
      switch (segment) {
        case '':
        case '.':
          break;
        case '..':
          if (out.length)
            out.pop();
          else
            up++;
          break;
        default:
          out.push(segment);
      }
    }
    if (!leadingSlash) {
      while (up-- > 0) {
        out.unshift('..');
      }
      if (out.length === 0)
        out.push('.');
    }
    return leadingSlash + out.join('/') + trailingSlash;
  }
  function joinAndCanonicalizePath(parts) {
    var path = parts[ComponentIndex.PATH] || '';
    path = removeDotSegments(path);
    parts[ComponentIndex.PATH] = path;
    return buildFromEncodedParts(parts[ComponentIndex.SCHEME], parts[ComponentIndex.USER_INFO], parts[ComponentIndex.DOMAIN], parts[ComponentIndex.PORT], parts[ComponentIndex.PATH], parts[ComponentIndex.QUERY_DATA], parts[ComponentIndex.FRAGMENT]);
  }
  function canonicalizeUrl(url) {
    var parts = split(url);
    return joinAndCanonicalizePath(parts);
  }
  function resolveUrl(base, url) {
    var parts = split(url);
    var baseParts = split(base);
    if (parts[ComponentIndex.SCHEME]) {
      return joinAndCanonicalizePath(parts);
    } else {
      parts[ComponentIndex.SCHEME] = baseParts[ComponentIndex.SCHEME];
    }
    for (var i = ComponentIndex.SCHEME; i <= ComponentIndex.PORT; i++) {
      if (!parts[i]) {
        parts[i] = baseParts[i];
      }
    }
    if (parts[ComponentIndex.PATH][0] == '/') {
      return joinAndCanonicalizePath(parts);
    }
    var path = baseParts[ComponentIndex.PATH];
    var index = path.lastIndexOf('/');
    path = path.slice(0, index + 1) + parts[ComponentIndex.PATH];
    parts[ComponentIndex.PATH] = path;
    return joinAndCanonicalizePath(parts);
  }
  function isAbsolute(name) {
    if (!name)
      return false;
    if (name[0] === '/')
      return true;
    var parts = split(name);
    if (parts[ComponentIndex.SCHEME])
      return true;
    return false;
  }
  $traceurRuntime.canonicalizeUrl = canonicalizeUrl;
  $traceurRuntime.isAbsolute = isAbsolute;
  $traceurRuntime.removeDotSegments = removeDotSegments;
  $traceurRuntime.resolveUrl = resolveUrl;
})();
(function(global) {
  'use strict';
  var $__2 = $traceurRuntime,
      canonicalizeUrl = $__2.canonicalizeUrl,
      resolveUrl = $__2.resolveUrl,
      isAbsolute = $__2.isAbsolute;
  var moduleInstantiators = Object.create(null);
  var baseURL;
  if (global.location && global.location.href)
    baseURL = resolveUrl(global.location.href, './');
  else
    baseURL = '';
  var UncoatedModuleEntry = function UncoatedModuleEntry(url, uncoatedModule) {
    this.url = url;
    this.value_ = uncoatedModule;
  };
  ($traceurRuntime.createClass)(UncoatedModuleEntry, {}, {});
  var UncoatedModuleInstantiator = function UncoatedModuleInstantiator(url, func) {
    $traceurRuntime.superCall(this, $UncoatedModuleInstantiator.prototype, "constructor", [url, null]);
    this.func = func;
  };
  var $UncoatedModuleInstantiator = UncoatedModuleInstantiator;
  ($traceurRuntime.createClass)(UncoatedModuleInstantiator, {getUncoatedModule: function() {
      if (this.value_)
        return this.value_;
      return this.value_ = this.func.call(global);
    }}, {}, UncoatedModuleEntry);
  function getUncoatedModuleInstantiator(name) {
    if (!name)
      return;
    var url = ModuleStore.normalize(name);
    return moduleInstantiators[url];
  }
  ;
  var moduleInstances = Object.create(null);
  var liveModuleSentinel = {};
  function Module(uncoatedModule) {
    var isLive = arguments[1];
    var coatedModule = Object.create(null);
    Object.getOwnPropertyNames(uncoatedModule).forEach((function(name) {
      var getter,
          value;
      if (isLive === liveModuleSentinel) {
        var descr = Object.getOwnPropertyDescriptor(uncoatedModule, name);
        if (descr.get)
          getter = descr.get;
      }
      if (!getter) {
        value = uncoatedModule[name];
        getter = function() {
          return value;
        };
      }
      Object.defineProperty(coatedModule, name, {
        get: getter,
        enumerable: true
      });
    }));
    Object.preventExtensions(coatedModule);
    return coatedModule;
  }
  var ModuleStore = {
    normalize: function(name, refererName, refererAddress) {
      if (typeof name !== "string")
        throw new TypeError("module name must be a string, not " + typeof name);
      if (isAbsolute(name))
        return canonicalizeUrl(name);
      if (/[^\.]\/\.\.\//.test(name)) {
        throw new Error('module name embeds /../: ' + name);
      }
      if (name[0] === '.' && refererName)
        return resolveUrl(refererName, name);
      return canonicalizeUrl(name);
    },
    get: function(normalizedName) {
      var m = getUncoatedModuleInstantiator(normalizedName);
      if (!m)
        return undefined;
      var moduleInstance = moduleInstances[m.url];
      if (moduleInstance)
        return moduleInstance;
      moduleInstance = Module(m.getUncoatedModule(), liveModuleSentinel);
      return moduleInstances[m.url] = moduleInstance;
    },
    set: function(normalizedName, module) {
      normalizedName = String(normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, (function() {
        return module;
      }));
      moduleInstances[normalizedName] = module;
    },
    get baseURL() {
      return baseURL;
    },
    set baseURL(v) {
      baseURL = String(v);
    },
    registerModule: function(name, func) {
      var normalizedName = ModuleStore.normalize(name);
      if (moduleInstantiators[normalizedName])
        throw new Error('duplicate module named ' + normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, func);
    },
    bundleStore: Object.create(null),
    register: function(name, deps, func) {
      if (!deps || !deps.length) {
        this.registerModule(name, func);
      } else {
        this.bundleStore[name] = {
          deps: deps,
          execute: func
        };
      }
    },
    getAnonymousModule: function(func) {
      return new Module(func.call(global), liveModuleSentinel);
    },
    getForTesting: function(name) {
      var $__0 = this;
      if (!this.testingPrefix_) {
        Object.keys(moduleInstances).some((function(key) {
          var m = /(traceur@[^\/]*\/)/.exec(key);
          if (m) {
            $__0.testingPrefix_ = m[1];
            return true;
          }
        }));
      }
      return this.get(this.testingPrefix_ + name);
    }
  };
  ModuleStore.set('@traceur/src/runtime/ModuleStore', new Module({ModuleStore: ModuleStore}));
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
  };
  $traceurRuntime.ModuleStore = ModuleStore;
  global.System = {
    register: ModuleStore.register.bind(ModuleStore),
    get: ModuleStore.get,
    set: ModuleStore.set,
    normalize: ModuleStore.normalize
  };
  $traceurRuntime.getModuleImpl = function(name) {
    var instantiator = getUncoatedModuleInstantiator(name);
    return instantiator && instantiator.getUncoatedModule();
  };
})(typeof global !== 'undefined' ? global : this);
System.register("traceur-runtime@0.0.32/src/runtime/polyfills/utils", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.32/src/runtime/polyfills/utils";
  var toObject = $traceurRuntime.toObject;
  function toUint32(x) {
    return x | 0;
  }
  return {
    get toObject() {
      return toObject;
    },
    get toUint32() {
      return toUint32;
    }
  };
});
System.register("traceur-runtime@0.0.32/src/runtime/polyfills/ArrayIterator", [], function() {
  "use strict";
  var $__4;
  var __moduleName = "traceur-runtime@0.0.32/src/runtime/polyfills/ArrayIterator";
  var $__5 = System.get("traceur-runtime@0.0.32/src/runtime/polyfills/utils"),
      toObject = $__5.toObject,
      toUint32 = $__5.toUint32;
  var ARRAY_ITERATOR_KIND_KEYS = 1;
  var ARRAY_ITERATOR_KIND_VALUES = 2;
  var ARRAY_ITERATOR_KIND_ENTRIES = 3;
  var ArrayIterator = function ArrayIterator() {};
  ($traceurRuntime.createClass)(ArrayIterator, ($__4 = {}, Object.defineProperty($__4, "next", {
    value: function() {
      var iterator = toObject(this);
      var array = iterator.iteratorObject_;
      if (!array) {
        throw new TypeError('Object is not an ArrayIterator');
      }
      var index = iterator.arrayIteratorNextIndex_;
      var itemKind = iterator.arrayIterationKind_;
      var length = toUint32(array.length);
      if (index >= length) {
        iterator.arrayIteratorNextIndex_ = Infinity;
        return createIteratorResultObject(undefined, true);
      }
      iterator.arrayIteratorNextIndex_ = index + 1;
      if (itemKind == ARRAY_ITERATOR_KIND_VALUES)
        return createIteratorResultObject(array[index], false);
      if (itemKind == ARRAY_ITERATOR_KIND_ENTRIES)
        return createIteratorResultObject([index, array[index]], false);
      return createIteratorResultObject(index, false);
    },
    configurable: true,
    enumerable: true,
    writable: true
  }), Object.defineProperty($__4, Symbol.iterator, {
    value: function() {
      return this;
    },
    configurable: true,
    enumerable: true,
    writable: true
  }), $__4), {});
  function createArrayIterator(array, kind) {
    var object = toObject(array);
    var iterator = new ArrayIterator;
    iterator.iteratorObject_ = object;
    iterator.arrayIteratorNextIndex_ = 0;
    iterator.arrayIterationKind_ = kind;
    return iterator;
  }
  function createIteratorResultObject(value, done) {
    return {
      value: value,
      done: done
    };
  }
  function entries() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_ENTRIES);
  }
  function keys() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_KEYS);
  }
  function values() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_VALUES);
  }
  return {
    get entries() {
      return entries;
    },
    get keys() {
      return keys;
    },
    get values() {
      return values;
    }
  };
});
System.register("traceur-runtime@0.0.32/node_modules/rsvp/lib/rsvp/asap", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.32/node_modules/rsvp/lib/rsvp/asap";
  var $__default = function asap(callback, arg) {
    var length = queue.push([callback, arg]);
    if (length === 1) {
      scheduleFlush();
    }
  };
  var browserGlobal = (typeof window !== 'undefined') ? window : {};
  var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
  function useNextTick() {
    return function() {
      process.nextTick(flush);
    };
  }
  function useMutationObserver() {
    var iterations = 0;
    var observer = new BrowserMutationObserver(flush);
    var node = document.createTextNode('');
    observer.observe(node, {characterData: true});
    return function() {
      node.data = (iterations = ++iterations % 2);
    };
  }
  function useSetTimeout() {
    return function() {
      setTimeout(flush, 1);
    };
  }
  var queue = [];
  function flush() {
    for (var i = 0; i < queue.length; i++) {
      var tuple = queue[i];
      var callback = tuple[0],
          arg = tuple[1];
      callback(arg);
    }
    queue = [];
  }
  var scheduleFlush;
  if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
    scheduleFlush = useNextTick();
  } else if (BrowserMutationObserver) {
    scheduleFlush = useMutationObserver();
  } else {
    scheduleFlush = useSetTimeout();
  }
  return {get default() {
      return $__default;
    }};
});
System.register("traceur-runtime@0.0.32/src/runtime/polyfills/Promise", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.32/src/runtime/polyfills/Promise";
  var async = System.get("traceur-runtime@0.0.32/node_modules/rsvp/lib/rsvp/asap").default;
  function isPromise(x) {
    return x && typeof x === 'object' && x.status_ !== undefined;
  }
  function chain(promise) {
    var onResolve = arguments[1] !== (void 0) ? arguments[1] : (function(x) {
      return x;
    });
    var onReject = arguments[2] !== (void 0) ? arguments[2] : (function(e) {
      throw e;
    });
    var deferred = getDeferred(promise.constructor);
    switch (promise.status_) {
      case undefined:
        throw TypeError;
      case 'pending':
        promise.onResolve_.push([deferred, onResolve]);
        promise.onReject_.push([deferred, onReject]);
        break;
      case 'resolved':
        promiseReact(deferred, onResolve, promise.value_);
        break;
      case 'rejected':
        promiseReact(deferred, onReject, promise.value_);
        break;
    }
    return deferred.promise;
  }
  function getDeferred(C) {
    var result = {};
    result.promise = new C((function(resolve, reject) {
      result.resolve = resolve;
      result.reject = reject;
    }));
    return result;
  }
  var Promise = function Promise(resolver) {
    var $__6 = this;
    this.status_ = 'pending';
    this.onResolve_ = [];
    this.onReject_ = [];
    resolver((function(x) {
      promiseResolve($__6, x);
    }), (function(r) {
      promiseReject($__6, r);
    }));
  };
  ($traceurRuntime.createClass)(Promise, {
    catch: function(onReject) {
      return this.then(undefined, onReject);
    },
    then: function() {
      var onResolve = arguments[0] !== (void 0) ? arguments[0] : (function(x) {
        return x;
      });
      var onReject = arguments[1];
      var $__6 = this;
      var constructor = this.constructor;
      return chain(this, (function(x) {
        x = promiseCoerce(constructor, x);
        return x === $__6 ? onReject(new TypeError) : isPromise(x) ? x.then(onResolve, onReject) : onResolve(x);
      }), onReject);
    }
  }, {
    resolve: function(x) {
      return new this((function(resolve, reject) {
        resolve(x);
      }));
    },
    reject: function(r) {
      return new this((function(resolve, reject) {
        reject(r);
      }));
    },
    cast: function(x) {
      if (x instanceof this)
        return x;
      if (isPromise(x)) {
        var result = getDeferred(this);
        chain(x, result.resolve, result.reject);
        return result.promise;
      }
      return this.resolve(x);
    },
    all: function(values) {
      var deferred = getDeferred(this);
      var count = 0;
      var resolutions = [];
      try {
        for (var i = 0; i < values.length; i++) {
          ++count;
          this.cast(values[i]).then(function(i, x) {
            resolutions[i] = x;
            if (--count === 0)
              deferred.resolve(resolutions);
          }.bind(undefined, i), (function(r) {
            if (count > 0)
              count = 0;
            deferred.reject(r);
          }));
        }
        if (count === 0)
          deferred.resolve(resolutions);
      } catch (e) {
        deferred.reject(e);
      }
      return deferred.promise;
    },
    race: function(values) {
      var deferred = getDeferred(this);
      try {
        for (var i = 0; i < values.length; i++) {
          this.cast(values[i]).then((function(x) {
            deferred.resolve(x);
          }), (function(r) {
            deferred.reject(r);
          }));
        }
      } catch (e) {
        deferred.reject(e);
      }
      return deferred.promise;
    }
  });
  function promiseResolve(promise, x) {
    promiseDone(promise, 'resolved', x, promise.onResolve_);
  }
  function promiseReject(promise, r) {
    promiseDone(promise, 'rejected', r, promise.onReject_);
  }
  function promiseDone(promise, status, value, reactions) {
    if (promise.status_ !== 'pending')
      return;
    for (var i = 0; i < reactions.length; i++) {
      promiseReact(reactions[i][0], reactions[i][1], value);
    }
    promise.status_ = status;
    promise.value_ = value;
    promise.onResolve_ = promise.onReject_ = undefined;
  }
  function promiseReact(deferred, handler, x) {
    async((function() {
      try {
        var y = handler(x);
        if (y === deferred.promise)
          throw new TypeError;
        else if (isPromise(y))
          chain(y, deferred.resolve, deferred.reject);
        else
          deferred.resolve(y);
      } catch (e) {
        deferred.reject(e);
      }
    }));
  }
  var thenableSymbol = '@@thenable';
  function promiseCoerce(constructor, x) {
    if (isPromise(x)) {
      return x;
    } else if (x && typeof x.then === 'function') {
      var p = x[thenableSymbol];
      if (p) {
        return p;
      } else {
        var deferred = getDeferred(constructor);
        x[thenableSymbol] = deferred.promise;
        try {
          x.then(deferred.resolve, deferred.reject);
        } catch (e) {
          deferred.reject(e);
        }
        return deferred.promise;
      }
    } else {
      return x;
    }
  }
  return {get Promise() {
      return Promise;
    }};
});
System.register("traceur-runtime@0.0.32/src/runtime/polyfills/String", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.32/src/runtime/polyfills/String";
  var $toString = Object.prototype.toString;
  var $indexOf = String.prototype.indexOf;
  var $lastIndexOf = String.prototype.lastIndexOf;
  function startsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1] : undefined;
    var pos = position ? Number(position) : 0;
    if (isNaN(pos)) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    return $indexOf.call(string, searchString, pos) == start;
  }
  function endsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var pos = stringLength;
    if (arguments.length > 1) {
      var position = arguments[1];
      if (position !== undefined) {
        pos = position ? Number(position) : 0;
        if (isNaN(pos)) {
          pos = 0;
        }
      }
    }
    var end = Math.min(Math.max(pos, 0), stringLength);
    var start = end - searchLength;
    if (start < 0) {
      return false;
    }
    return $lastIndexOf.call(string, searchString, start) == start;
  }
  function contains(search) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1] : undefined;
    var pos = position ? Number(position) : 0;
    if (isNaN(pos)) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    return $indexOf.call(string, searchString, pos) != -1;
  }
  function repeat(count) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var n = count ? Number(count) : 0;
    if (isNaN(n)) {
      n = 0;
    }
    if (n < 0 || n == Infinity) {
      throw RangeError();
    }
    if (n == 0) {
      return '';
    }
    var result = '';
    while (n--) {
      result += string;
    }
    return result;
  }
  function codePointAt(position) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var size = string.length;
    var index = position ? Number(position) : 0;
    if (isNaN(index)) {
      index = 0;
    }
    if (index < 0 || index >= size) {
      return undefined;
    }
    var first = string.charCodeAt(index);
    var second;
    if (first >= 0xD800 && first <= 0xDBFF && size > index + 1) {
      second = string.charCodeAt(index + 1);
      if (second >= 0xDC00 && second <= 0xDFFF) {
        return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
      }
    }
    return first;
  }
  function raw(callsite) {
    var raw = callsite.raw;
    var len = raw.length >>> 0;
    if (len === 0)
      return '';
    var s = '';
    var i = 0;
    while (true) {
      s += raw[i];
      if (i + 1 === len)
        return s;
      s += arguments[++i];
    }
  }
  function fromCodePoint() {
    var codeUnits = [];
    var floor = Math.floor;
    var highSurrogate;
    var lowSurrogate;
    var index = -1;
    var length = arguments.length;
    if (!length) {
      return '';
    }
    while (++index < length) {
      var codePoint = Number(arguments[index]);
      if (!isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF || floor(codePoint) != codePoint) {
        throw RangeError('Invalid code point: ' + codePoint);
      }
      if (codePoint <= 0xFFFF) {
        codeUnits.push(codePoint);
      } else {
        codePoint -= 0x10000;
        highSurrogate = (codePoint >> 10) + 0xD800;
        lowSurrogate = (codePoint % 0x400) + 0xDC00;
        codeUnits.push(highSurrogate, lowSurrogate);
      }
    }
    return String.fromCharCode.apply(null, codeUnits);
  }
  return {
    get startsWith() {
      return startsWith;
    },
    get endsWith() {
      return endsWith;
    },
    get contains() {
      return contains;
    },
    get repeat() {
      return repeat;
    },
    get codePointAt() {
      return codePointAt;
    },
    get raw() {
      return raw;
    },
    get fromCodePoint() {
      return fromCodePoint;
    }
  };
});
System.register("traceur-runtime@0.0.32/src/runtime/polyfills/polyfills", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.32/src/runtime/polyfills/polyfills";
  var Promise = System.get("traceur-runtime@0.0.32/src/runtime/polyfills/Promise").Promise;
  var $__9 = System.get("traceur-runtime@0.0.32/src/runtime/polyfills/String"),
      codePointAt = $__9.codePointAt,
      contains = $__9.contains,
      endsWith = $__9.endsWith,
      fromCodePoint = $__9.fromCodePoint,
      repeat = $__9.repeat,
      raw = $__9.raw,
      startsWith = $__9.startsWith;
  var $__9 = System.get("traceur-runtime@0.0.32/src/runtime/polyfills/ArrayIterator"),
      entries = $__9.entries,
      keys = $__9.keys,
      values = $__9.values;
  function maybeDefineMethod(object, name, value) {
    if (!(name in object)) {
      Object.defineProperty(object, name, {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
  }
  function maybeAddFunctions(object, functions) {
    for (var i = 0; i < functions.length; i += 2) {
      var name = functions[i];
      var value = functions[i + 1];
      maybeDefineMethod(object, name, value);
    }
  }
  function polyfillPromise(global) {
    if (!global.Promise)
      global.Promise = Promise;
  }
  function polyfillString(String) {
    maybeAddFunctions(String.prototype, ['codePointAt', codePointAt, 'contains', contains, 'endsWith', endsWith, 'startsWith', startsWith, 'repeat', repeat]);
    maybeAddFunctions(String, ['fromCodePoint', fromCodePoint, 'raw', raw]);
  }
  function polyfillArray(Array, Symbol) {
    maybeAddFunctions(Array.prototype, ['entries', entries, 'keys', keys, 'values', values]);
    if (Symbol && Symbol.iterator) {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        value: values,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
  }
  function polyfill(global) {
    polyfillPromise(global);
    polyfillString(global.String);
    polyfillArray(global.Array, global.Symbol);
  }
  polyfill(this);
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
    polyfill(global);
  };
  return {};
});
System.register("traceur-runtime@0.0.32/src/runtime/polyfill-import", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.32/src/runtime/polyfill-import";
  var $__11 = System.get("traceur-runtime@0.0.32/src/runtime/polyfills/polyfills");
  return {};
});
System.get("traceur-runtime@0.0.32/src/runtime/polyfill-import" + '');

}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],15:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/AutoFocusMixin";
"use strict";
var AutoFocusMixin = {componentDidMount: function() {
    if (this.props.autoFocus) {
      this.getDOMNode().focus();
    }
  }};
module.exports = AutoFocusMixin;


},{}],16:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/CSSProperty";
"use strict";
var isUnitlessNumber = {
  columnCount: true,
  fillOpacity: true,
  flex: true,
  flexGrow: true,
  flexShrink: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  widows: true,
  zIndex: true,
  zoom: true
};
function prefixKey(prefix, key) {
  return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}
var prefixes = ['Webkit', 'ms', 'Moz', 'O'];
Object.keys(isUnitlessNumber).forEach(function(prop) {
  prefixes.forEach(function(prefix) {
    isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
  });
});
var shorthandPropertyExpansions = {
  background: {
    backgroundImage: true,
    backgroundPosition: true,
    backgroundRepeat: true,
    backgroundColor: true
  },
  border: {
    borderWidth: true,
    borderStyle: true,
    borderColor: true
  },
  borderBottom: {
    borderBottomWidth: true,
    borderBottomStyle: true,
    borderBottomColor: true
  },
  borderLeft: {
    borderLeftWidth: true,
    borderLeftStyle: true,
    borderLeftColor: true
  },
  borderRight: {
    borderRightWidth: true,
    borderRightStyle: true,
    borderRightColor: true
  },
  borderTop: {
    borderTopWidth: true,
    borderTopStyle: true,
    borderTopColor: true
  },
  font: {
    fontStyle: true,
    fontVariant: true,
    fontWeight: true,
    fontSize: true,
    lineHeight: true,
    fontFamily: true
  }
};
var CSSProperty = {
  isUnitlessNumber: isUnitlessNumber,
  shorthandPropertyExpansions: shorthandPropertyExpansions
};
module.exports = CSSProperty;


},{}],17:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/CSSPropertyOperations";
"use strict";
var CSSProperty = require("./CSSProperty");
var dangerousStyleValue = require("./dangerousStyleValue");
var escapeTextForBrowser = require("./escapeTextForBrowser");
var hyphenate = require("./hyphenate");
var memoizeStringOnly = require("./memoizeStringOnly");
var processStyleName = memoizeStringOnly(function(styleName) {
  return escapeTextForBrowser(hyphenate(styleName));
});
var CSSPropertyOperations = {
  createMarkupForStyles: function(styles) {
    var serialized = '';
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      var styleValue = styles[styleName];
      if (styleValue != null) {
        serialized += processStyleName(styleName) + ':';
        serialized += dangerousStyleValue(styleName, styleValue) + ';';
      }
    }
    return serialized || null;
  },
  setValueForStyles: function(node, styles) {
    var style = node.style;
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      var styleValue = dangerousStyleValue(styleName, styles[styleName]);
      if (styleValue) {
        style[styleName] = styleValue;
      } else {
        var expansion = CSSProperty.shorthandPropertyExpansions[styleName];
        if (expansion) {
          for (var individualStyleName in expansion) {
            style[individualStyleName] = '';
          }
        } else {
          style[styleName] = '';
        }
      }
    }
  }
};
module.exports = CSSPropertyOperations;


},{"./CSSProperty":16,"./dangerousStyleValue":108,"./escapeTextForBrowser":110,"./hyphenate":121,"./memoizeStringOnly":130}],18:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ChangeEventPlugin";
"use strict";
var EventConstants = require("./EventConstants");
var EventPluginHub = require("./EventPluginHub");
var EventPropagators = require("./EventPropagators");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var ReactUpdates = require("./ReactUpdates");
var SyntheticEvent = require("./SyntheticEvent");
var isEventSupported = require("./isEventSupported");
var isTextInputElement = require("./isTextInputElement");
var keyOf = require("./keyOf");
var topLevelTypes = EventConstants.topLevelTypes;
var eventTypes = {change: {
    phasedRegistrationNames: {
      bubbled: keyOf({onChange: null}),
      captured: keyOf({onChangeCapture: null})
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topChange, topLevelTypes.topClick, topLevelTypes.topFocus, topLevelTypes.topInput, topLevelTypes.topKeyDown, topLevelTypes.topKeyUp, topLevelTypes.topSelectionChange]
  }};
var activeElement = null;
var activeElementID = null;
var activeElementValue = null;
var activeElementValueProp = null;
function shouldUseChangeEvent(elem) {
  return (elem.nodeName === 'SELECT' || (elem.nodeName === 'INPUT' && elem.type === 'file'));
}
var doesChangeEventBubble = false;
if (ExecutionEnvironment.canUseDOM) {
  doesChangeEventBubble = isEventSupported('change') && (!('documentMode' in document) || document.documentMode > 8);
}
function manualDispatchChangeEvent(nativeEvent) {
  var event = SyntheticEvent.getPooled(eventTypes.change, activeElementID, nativeEvent);
  EventPropagators.accumulateTwoPhaseDispatches(event);
  ReactUpdates.batchedUpdates(runEventInBatch, event);
}
function runEventInBatch(event) {
  EventPluginHub.enqueueEvents(event);
  EventPluginHub.processEventQueue();
}
function startWatchingForChangeEventIE8(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElement.attachEvent('onchange', manualDispatchChangeEvent);
}
function stopWatchingForChangeEventIE8() {
  if (!activeElement) {
    return;
  }
  activeElement.detachEvent('onchange', manualDispatchChangeEvent);
  activeElement = null;
  activeElementID = null;
}
function getTargetIDForChangeEvent(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topChange) {
    return topLevelTargetID;
  }
}
function handleEventsForChangeEventIE8(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    stopWatchingForChangeEventIE8();
    startWatchingForChangeEventIE8(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForChangeEventIE8();
  }
}
var isInputEventSupported = false;
if (ExecutionEnvironment.canUseDOM) {
  isInputEventSupported = isEventSupported('input') && (!('documentMode' in document) || document.documentMode > 9);
}
var newValueProp = {
  get: function() {
    return activeElementValueProp.get.call(this);
  },
  set: function(val) {
    activeElementValue = '' + val;
    activeElementValueProp.set.call(this, val);
  }
};
function startWatchingForValueChange(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElementValue = target.value;
  activeElementValueProp = Object.getOwnPropertyDescriptor(target.constructor.prototype, 'value');
  Object.defineProperty(activeElement, 'value', newValueProp);
  activeElement.attachEvent('onpropertychange', handlePropertyChange);
}
function stopWatchingForValueChange() {
  if (!activeElement) {
    return;
  }
  delete activeElement.value;
  activeElement.detachEvent('onpropertychange', handlePropertyChange);
  activeElement = null;
  activeElementID = null;
  activeElementValue = null;
  activeElementValueProp = null;
}
function handlePropertyChange(nativeEvent) {
  if (nativeEvent.propertyName !== 'value') {
    return;
  }
  var value = nativeEvent.srcElement.value;
  if (value === activeElementValue) {
    return;
  }
  activeElementValue = value;
  manualDispatchChangeEvent(nativeEvent);
}
function getTargetIDForInputEvent(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topInput) {
    return topLevelTargetID;
  }
}
function handleEventsForInputEventIE(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    stopWatchingForValueChange();
    startWatchingForValueChange(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForValueChange();
  }
}
function getTargetIDForInputEventIE(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topSelectionChange || topLevelType === topLevelTypes.topKeyUp || topLevelType === topLevelTypes.topKeyDown) {
    if (activeElement && activeElement.value !== activeElementValue) {
      activeElementValue = activeElement.value;
      return activeElementID;
    }
  }
}
function shouldUseClickEvent(elem) {
  return (elem.nodeName === 'INPUT' && (elem.type === 'checkbox' || elem.type === 'radio'));
}
function getTargetIDForClickEvent(topLevelType, topLevelTarget, topLevelTargetID) {
  if (topLevelType === topLevelTypes.topClick) {
    return topLevelTargetID;
  }
}
var ChangeEventPlugin = {
  eventTypes: eventTypes,
  extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    var getTargetIDFunc,
        handleEventFunc;
    if (shouldUseChangeEvent(topLevelTarget)) {
      if (doesChangeEventBubble) {
        getTargetIDFunc = getTargetIDForChangeEvent;
      } else {
        handleEventFunc = handleEventsForChangeEventIE8;
      }
    } else if (isTextInputElement(topLevelTarget)) {
      if (isInputEventSupported) {
        getTargetIDFunc = getTargetIDForInputEvent;
      } else {
        getTargetIDFunc = getTargetIDForInputEventIE;
        handleEventFunc = handleEventsForInputEventIE;
      }
    } else if (shouldUseClickEvent(topLevelTarget)) {
      getTargetIDFunc = getTargetIDForClickEvent;
    }
    if (getTargetIDFunc) {
      var targetID = getTargetIDFunc(topLevelType, topLevelTarget, topLevelTargetID);
      if (targetID) {
        var event = SyntheticEvent.getPooled(eventTypes.change, targetID, nativeEvent);
        EventPropagators.accumulateTwoPhaseDispatches(event);
        return event;
      }
    }
    if (handleEventFunc) {
      handleEventFunc(topLevelType, topLevelTarget, topLevelTargetID);
    }
  }
};
module.exports = ChangeEventPlugin;


},{"./EventConstants":28,"./EventPluginHub":30,"./EventPropagators":33,"./ExecutionEnvironment":34,"./ReactUpdates":84,"./SyntheticEvent":91,"./isEventSupported":123,"./isTextInputElement":125,"./keyOf":129}],19:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ClientReactRootIndex";
"use strict";
var nextReactRootIndex = 0;
var ClientReactRootIndex = {createReactRootIndex: function() {
    return nextReactRootIndex++;
  }};
module.exports = ClientReactRootIndex;


},{}],20:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/CompositionEventPlugin";
"use strict";
var EventConstants = require("./EventConstants");
var EventPropagators = require("./EventPropagators");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var ReactInputSelection = require("./ReactInputSelection");
var SyntheticCompositionEvent = require("./SyntheticCompositionEvent");
var getTextContentAccessor = require("./getTextContentAccessor");
var keyOf = require("./keyOf");
var END_KEYCODES = [9, 13, 27, 32];
var START_KEYCODE = 229;
var useCompositionEvent = (ExecutionEnvironment.canUseDOM && 'CompositionEvent' in window);
var useFallbackData = (!useCompositionEvent || 'documentMode' in document && document.documentMode > 8);
var topLevelTypes = EventConstants.topLevelTypes;
var currentComposition = null;
var eventTypes = {
  compositionEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionEnd: null}),
      captured: keyOf({onCompositionEndCapture: null})
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionEnd, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
  },
  compositionStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionStart: null}),
      captured: keyOf({onCompositionStartCapture: null})
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionStart, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
  },
  compositionUpdate: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionUpdate: null}),
      captured: keyOf({onCompositionUpdateCapture: null})
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionUpdate, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]
  }
};
function getCompositionEventType(topLevelType) {
  switch (topLevelType) {
    case topLevelTypes.topCompositionStart:
      return eventTypes.compositionStart;
    case topLevelTypes.topCompositionEnd:
      return eventTypes.compositionEnd;
    case topLevelTypes.topCompositionUpdate:
      return eventTypes.compositionUpdate;
  }
}
function isFallbackStart(topLevelType, nativeEvent) {
  return (topLevelType === topLevelTypes.topKeyDown && nativeEvent.keyCode === START_KEYCODE);
}
function isFallbackEnd(topLevelType, nativeEvent) {
  switch (topLevelType) {
    case topLevelTypes.topKeyUp:
      return (END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1);
    case topLevelTypes.topKeyDown:
      return (nativeEvent.keyCode !== START_KEYCODE);
    case topLevelTypes.topKeyPress:
    case topLevelTypes.topMouseDown:
    case topLevelTypes.topBlur:
      return true;
    default:
      return false;
  }
}
function FallbackCompositionState(root) {
  this.root = root;
  this.startSelection = ReactInputSelection.getSelection(root);
  this.startValue = this.getText();
}
FallbackCompositionState.prototype.getText = function() {
  return this.root.value || this.root[getTextContentAccessor()];
};
FallbackCompositionState.prototype.getData = function() {
  var endValue = this.getText();
  var prefixLength = this.startSelection.start;
  var suffixLength = this.startValue.length - this.startSelection.end;
  return endValue.substr(prefixLength, endValue.length - suffixLength - prefixLength);
};
var CompositionEventPlugin = {
  eventTypes: eventTypes,
  extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    var eventType;
    var data;
    if (useCompositionEvent) {
      eventType = getCompositionEventType(topLevelType);
    } else if (!currentComposition) {
      if (isFallbackStart(topLevelType, nativeEvent)) {
        eventType = eventTypes.compositionStart;
      }
    } else if (isFallbackEnd(topLevelType, nativeEvent)) {
      eventType = eventTypes.compositionEnd;
    }
    if (useFallbackData) {
      if (!currentComposition && eventType === eventTypes.compositionStart) {
        currentComposition = new FallbackCompositionState(topLevelTarget);
      } else if (eventType === eventTypes.compositionEnd) {
        if (currentComposition) {
          data = currentComposition.getData();
          currentComposition = null;
        }
      }
    }
    if (eventType) {
      var event = SyntheticCompositionEvent.getPooled(eventType, topLevelTargetID, nativeEvent);
      if (data) {
        event.data = data;
      }
      EventPropagators.accumulateTwoPhaseDispatches(event);
      return event;
    }
  }
};
module.exports = CompositionEventPlugin;


},{"./EventConstants":28,"./EventPropagators":33,"./ExecutionEnvironment":34,"./ReactInputSelection":66,"./SyntheticCompositionEvent":89,"./getTextContentAccessor":119,"./keyOf":129}],21:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/DOMChildrenOperations";
"use strict";
var Danger = require("./Danger");
var ReactMultiChildUpdateTypes = require("./ReactMultiChildUpdateTypes");
var getTextContentAccessor = require("./getTextContentAccessor");
var textContentAccessor = getTextContentAccessor();
function insertChildAt(parentNode, childNode, index) {
  var childNodes = parentNode.childNodes;
  if (childNodes[index] === childNode) {
    return;
  }
  if (childNode.parentNode === parentNode) {
    parentNode.removeChild(childNode);
  }
  if (index >= childNodes.length) {
    parentNode.appendChild(childNode);
  } else {
    parentNode.insertBefore(childNode, childNodes[index]);
  }
}
var updateTextContent;
if (textContentAccessor === 'textContent') {
  updateTextContent = function(node, text) {
    node.textContent = text;
  };
} else {
  updateTextContent = function(node, text) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
    if (text) {
      var doc = node.ownerDocument || document;
      node.appendChild(doc.createTextNode(text));
    }
  };
}
var DOMChildrenOperations = {
  dangerouslyReplaceNodeWithMarkup: Danger.dangerouslyReplaceNodeWithMarkup,
  updateTextContent: updateTextContent,
  processUpdates: function(updates, markupList) {
    var update;
    var initialChildren = null;
    var updatedChildren = null;
    for (var i = 0; update = updates[i]; i++) {
      if (update.type === ReactMultiChildUpdateTypes.MOVE_EXISTING || update.type === ReactMultiChildUpdateTypes.REMOVE_NODE) {
        var updatedIndex = update.fromIndex;
        var updatedChild = update.parentNode.childNodes[updatedIndex];
        var parentID = update.parentID;
        initialChildren = initialChildren || {};
        initialChildren[parentID] = initialChildren[parentID] || [];
        initialChildren[parentID][updatedIndex] = updatedChild;
        updatedChildren = updatedChildren || [];
        updatedChildren.push(updatedChild);
      }
    }
    var renderedMarkup = Danger.dangerouslyRenderMarkup(markupList);
    if (updatedChildren) {
      for (var j = 0; j < updatedChildren.length; j++) {
        updatedChildren[j].parentNode.removeChild(updatedChildren[j]);
      }
    }
    for (var k = 0; update = updates[k]; k++) {
      switch (update.type) {
        case ReactMultiChildUpdateTypes.INSERT_MARKUP:
          insertChildAt(update.parentNode, renderedMarkup[update.markupIndex], update.toIndex);
          break;
        case ReactMultiChildUpdateTypes.MOVE_EXISTING:
          insertChildAt(update.parentNode, initialChildren[update.parentID][update.fromIndex], update.toIndex);
          break;
        case ReactMultiChildUpdateTypes.TEXT_CONTENT:
          updateTextContent(update.parentNode, update.textContent);
          break;
        case ReactMultiChildUpdateTypes.REMOVE_NODE:
          break;
      }
    }
  }
};
module.exports = DOMChildrenOperations;


},{"./Danger":24,"./ReactMultiChildUpdateTypes":72,"./getTextContentAccessor":119}],22:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/DOMProperty";
"use strict";
var invariant = require("./invariant");
var DOMPropertyInjection = {
  MUST_USE_ATTRIBUTE: 0x1,
  MUST_USE_PROPERTY: 0x2,
  HAS_SIDE_EFFECTS: 0x4,
  HAS_BOOLEAN_VALUE: 0x8,
  HAS_POSITIVE_NUMERIC_VALUE: 0x10,
  injectDOMPropertyConfig: function(domPropertyConfig) {
    var Properties = domPropertyConfig.Properties || {};
    var DOMAttributeNames = domPropertyConfig.DOMAttributeNames || {};
    var DOMPropertyNames = domPropertyConfig.DOMPropertyNames || {};
    var DOMMutationMethods = domPropertyConfig.DOMMutationMethods || {};
    if (domPropertyConfig.isCustomAttribute) {
      DOMProperty._isCustomAttributeFunctions.push(domPropertyConfig.isCustomAttribute);
    }
    for (var propName in Properties) {
      ("production" !== process.env.NODE_ENV ? invariant(!DOMProperty.isStandardName[propName], 'injectDOMPropertyConfig(...): You\'re trying to inject DOM property ' + '\'%s\' which has already been injected. You may be accidentally ' + 'injecting the same DOM property config twice, or you may be ' + 'injecting two configs that have conflicting property names.', propName) : invariant(!DOMProperty.isStandardName[propName]));
      DOMProperty.isStandardName[propName] = true;
      var lowerCased = propName.toLowerCase();
      DOMProperty.getPossibleStandardName[lowerCased] = propName;
      var attributeName = DOMAttributeNames[propName];
      if (attributeName) {
        DOMProperty.getPossibleStandardName[attributeName] = propName;
      }
      DOMProperty.getAttributeName[propName] = attributeName || lowerCased;
      DOMProperty.getPropertyName[propName] = DOMPropertyNames[propName] || propName;
      var mutationMethod = DOMMutationMethods[propName];
      if (mutationMethod) {
        DOMProperty.getMutationMethod[propName] = mutationMethod;
      }
      var propConfig = Properties[propName];
      DOMProperty.mustUseAttribute[propName] = propConfig & DOMPropertyInjection.MUST_USE_ATTRIBUTE;
      DOMProperty.mustUseProperty[propName] = propConfig & DOMPropertyInjection.MUST_USE_PROPERTY;
      DOMProperty.hasSideEffects[propName] = propConfig & DOMPropertyInjection.HAS_SIDE_EFFECTS;
      DOMProperty.hasBooleanValue[propName] = propConfig & DOMPropertyInjection.HAS_BOOLEAN_VALUE;
      DOMProperty.hasPositiveNumericValue[propName] = propConfig & DOMPropertyInjection.HAS_POSITIVE_NUMERIC_VALUE;
      ("production" !== process.env.NODE_ENV ? invariant(!DOMProperty.mustUseAttribute[propName] || !DOMProperty.mustUseProperty[propName], 'DOMProperty: Cannot require using both attribute and property: %s', propName) : invariant(!DOMProperty.mustUseAttribute[propName] || !DOMProperty.mustUseProperty[propName]));
      ("production" !== process.env.NODE_ENV ? invariant(DOMProperty.mustUseProperty[propName] || !DOMProperty.hasSideEffects[propName], 'DOMProperty: Properties that have side effects must use property: %s', propName) : invariant(DOMProperty.mustUseProperty[propName] || !DOMProperty.hasSideEffects[propName]));
      ("production" !== process.env.NODE_ENV ? invariant(!DOMProperty.hasBooleanValue[propName] || !DOMProperty.hasPositiveNumericValue[propName], 'DOMProperty: Cannot have both boolean and positive numeric value: %s', propName) : invariant(!DOMProperty.hasBooleanValue[propName] || !DOMProperty.hasPositiveNumericValue[propName]));
    }
  }
};
var defaultValueCache = {};
var DOMProperty = {
  ID_ATTRIBUTE_NAME: 'data-reactid',
  isStandardName: {},
  getPossibleStandardName: {},
  getAttributeName: {},
  getPropertyName: {},
  getMutationMethod: {},
  mustUseAttribute: {},
  mustUseProperty: {},
  hasSideEffects: {},
  hasBooleanValue: {},
  hasPositiveNumericValue: {},
  _isCustomAttributeFunctions: [],
  isCustomAttribute: function(attributeName) {
    return DOMProperty._isCustomAttributeFunctions.some(function(isCustomAttributeFn) {
      return isCustomAttributeFn.call(null, attributeName);
    });
  },
  getDefaultValueForProperty: function(nodeName, prop) {
    var nodeDefaults = defaultValueCache[nodeName];
    var testElement;
    if (!nodeDefaults) {
      defaultValueCache[nodeName] = nodeDefaults = {};
    }
    if (!(prop in nodeDefaults)) {
      testElement = document.createElement(nodeName);
      nodeDefaults[prop] = testElement[prop];
    }
    return nodeDefaults[prop];
  },
  injection: DOMPropertyInjection
};
module.exports = DOMProperty;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],23:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/DOMPropertyOperations";
"use strict";
var DOMProperty = require("./DOMProperty");
var escapeTextForBrowser = require("./escapeTextForBrowser");
var memoizeStringOnly = require("./memoizeStringOnly");
function shouldIgnoreValue(name, value) {
  return value == null || DOMProperty.hasBooleanValue[name] && !value || DOMProperty.hasPositiveNumericValue[name] && (isNaN(value) || value < 1);
}
var processAttributeNameAndPrefix = memoizeStringOnly(function(name) {
  return escapeTextForBrowser(name) + '="';
});
if ("production" !== process.env.NODE_ENV) {
  var reactProps = {
    children: true,
    dangerouslySetInnerHTML: true,
    key: true,
    ref: true
  };
  var warnedProperties = {};
  var warnUnknownProperty = function(name) {
    if (reactProps[name] || warnedProperties[name]) {
      return;
    }
    warnedProperties[name] = true;
    var lowerCasedName = name.toLowerCase();
    var standardName = DOMProperty.isCustomAttribute(lowerCasedName) ? lowerCasedName : DOMProperty.getPossibleStandardName[lowerCasedName];
    if (standardName != null) {
      console.warn('Unknown DOM property ' + name + '. Did you mean ' + standardName + '?');
    }
  };
}
var DOMPropertyOperations = {
  createMarkupForID: function(id) {
    return processAttributeNameAndPrefix(DOMProperty.ID_ATTRIBUTE_NAME) + escapeTextForBrowser(id) + '"';
  },
  createMarkupForProperty: function(name, value) {
    if (DOMProperty.isStandardName[name]) {
      if (shouldIgnoreValue(name, value)) {
        return '';
      }
      var attributeName = DOMProperty.getAttributeName[name];
      if (DOMProperty.hasBooleanValue[name]) {
        return escapeTextForBrowser(attributeName);
      }
      return processAttributeNameAndPrefix(attributeName) + escapeTextForBrowser(value) + '"';
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        return '';
      }
      return processAttributeNameAndPrefix(name) + escapeTextForBrowser(value) + '"';
    } else if ("production" !== process.env.NODE_ENV) {
      warnUnknownProperty(name);
    }
    return null;
  },
  setValueForProperty: function(node, name, value) {
    if (DOMProperty.isStandardName[name]) {
      var mutationMethod = DOMProperty.getMutationMethod[name];
      if (mutationMethod) {
        mutationMethod(node, value);
      } else if (shouldIgnoreValue(name, value)) {
        this.deleteValueForProperty(node, name);
      } else if (DOMProperty.mustUseAttribute[name]) {
        node.setAttribute(DOMProperty.getAttributeName[name], '' + value);
      } else {
        var propName = DOMProperty.getPropertyName[name];
        if (!DOMProperty.hasSideEffects[name] || node[propName] !== value) {
          node[propName] = value;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        node.removeAttribute(DOMProperty.getAttributeName[name]);
      } else {
        node.setAttribute(name, '' + value);
      }
    } else if ("production" !== process.env.NODE_ENV) {
      warnUnknownProperty(name);
    }
  },
  deleteValueForProperty: function(node, name) {
    if (DOMProperty.isStandardName[name]) {
      var mutationMethod = DOMProperty.getMutationMethod[name];
      if (mutationMethod) {
        mutationMethod(node, undefined);
      } else if (DOMProperty.mustUseAttribute[name]) {
        node.removeAttribute(DOMProperty.getAttributeName[name]);
      } else {
        var propName = DOMProperty.getPropertyName[name];
        var defaultValue = DOMProperty.getDefaultValueForProperty(node.nodeName, name);
        if (!DOMProperty.hasSideEffects[name] || node[propName] !== defaultValue) {
          node[propName] = defaultValue;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      node.removeAttribute(name);
    } else if ("production" !== process.env.NODE_ENV) {
      warnUnknownProperty(name);
    }
  }
};
module.exports = DOMPropertyOperations;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./DOMProperty":22,"./escapeTextForBrowser":110,"./memoizeStringOnly":130,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],24:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/Danger";
"use strict";
var ExecutionEnvironment = require("./ExecutionEnvironment");
var createNodesFromMarkup = require("./createNodesFromMarkup");
var emptyFunction = require("./emptyFunction");
var getMarkupWrap = require("./getMarkupWrap");
var invariant = require("./invariant");
var OPEN_TAG_NAME_EXP = /^(<[^ \/>]+)/;
var RESULT_INDEX_ATTR = 'data-danger-index';
function getNodeName(markup) {
  return markup.substring(1, markup.indexOf(' '));
}
var Danger = {
  dangerouslyRenderMarkup: function(markupList) {
    ("production" !== process.env.NODE_ENV ? invariant(ExecutionEnvironment.canUseDOM, 'dangerouslyRenderMarkup(...): Cannot render markup in a Worker ' + 'thread. This is likely a bug in the framework. Please report ' + 'immediately.') : invariant(ExecutionEnvironment.canUseDOM));
    var nodeName;
    var markupByNodeName = {};
    for (var i = 0; i < markupList.length; i++) {
      ("production" !== process.env.NODE_ENV ? invariant(markupList[i], 'dangerouslyRenderMarkup(...): Missing markup.') : invariant(markupList[i]));
      nodeName = getNodeName(markupList[i]);
      nodeName = getMarkupWrap(nodeName) ? nodeName : '*';
      markupByNodeName[nodeName] = markupByNodeName[nodeName] || [];
      markupByNodeName[nodeName][i] = markupList[i];
    }
    var resultList = [];
    var resultListAssignmentCount = 0;
    for (nodeName in markupByNodeName) {
      if (!markupByNodeName.hasOwnProperty(nodeName)) {
        continue;
      }
      var markupListByNodeName = markupByNodeName[nodeName];
      for (var resultIndex in markupListByNodeName) {
        if (markupListByNodeName.hasOwnProperty(resultIndex)) {
          var markup = markupListByNodeName[resultIndex];
          markupListByNodeName[resultIndex] = markup.replace(OPEN_TAG_NAME_EXP, '$1 ' + RESULT_INDEX_ATTR + '="' + resultIndex + '" ');
        }
      }
      var renderNodes = createNodesFromMarkup(markupListByNodeName.join(''), emptyFunction);
      for (i = 0; i < renderNodes.length; ++i) {
        var renderNode = renderNodes[i];
        if (renderNode.hasAttribute && renderNode.hasAttribute(RESULT_INDEX_ATTR)) {
          resultIndex = +renderNode.getAttribute(RESULT_INDEX_ATTR);
          renderNode.removeAttribute(RESULT_INDEX_ATTR);
          ("production" !== process.env.NODE_ENV ? invariant(!resultList.hasOwnProperty(resultIndex), 'Danger: Assigning to an already-occupied result index.') : invariant(!resultList.hasOwnProperty(resultIndex)));
          resultList[resultIndex] = renderNode;
          resultListAssignmentCount += 1;
        } else if ("production" !== process.env.NODE_ENV) {
          console.error("Danger: Discarding unexpected node:", renderNode);
        }
      }
    }
    ("production" !== process.env.NODE_ENV ? invariant(resultListAssignmentCount === resultList.length, 'Danger: Did not assign to every index of resultList.') : invariant(resultListAssignmentCount === resultList.length));
    ("production" !== process.env.NODE_ENV ? invariant(resultList.length === markupList.length, 'Danger: Expected markup to render %s nodes, but rendered %s.', markupList.length, resultList.length) : invariant(resultList.length === markupList.length));
    return resultList;
  },
  dangerouslyReplaceNodeWithMarkup: function(oldChild, markup) {
    ("production" !== process.env.NODE_ENV ? invariant(ExecutionEnvironment.canUseDOM, 'dangerouslyReplaceNodeWithMarkup(...): Cannot render markup in a ' + 'worker thread. This is likely a bug in the framework. Please report ' + 'immediately.') : invariant(ExecutionEnvironment.canUseDOM));
    ("production" !== process.env.NODE_ENV ? invariant(markup, 'dangerouslyReplaceNodeWithMarkup(...): Missing markup.') : invariant(markup));
    ("production" !== process.env.NODE_ENV ? invariant(oldChild.tagName.toLowerCase() !== 'html', 'dangerouslyReplaceNodeWithMarkup(...): Cannot replace markup of the ' + '<html> node. This is because browser quirks make this unreliable ' + 'and/or slow. If you want to render to the root you must use ' + 'server rendering. See renderComponentToString().') : invariant(oldChild.tagName.toLowerCase() !== 'html'));
    var newChild = createNodesFromMarkup(markup, emptyFunction)[0];
    oldChild.parentNode.replaceChild(newChild, oldChild);
  }
};
module.exports = Danger;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ExecutionEnvironment":34,"./createNodesFromMarkup":106,"./emptyFunction":109,"./getMarkupWrap":116,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],25:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/DefaultDOMPropertyConfig";
"use strict";
var DOMProperty = require("./DOMProperty");
var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;
var MUST_USE_PROPERTY = DOMProperty.injection.MUST_USE_PROPERTY;
var HAS_BOOLEAN_VALUE = DOMProperty.injection.HAS_BOOLEAN_VALUE;
var HAS_SIDE_EFFECTS = DOMProperty.injection.HAS_SIDE_EFFECTS;
var HAS_POSITIVE_NUMERIC_VALUE = DOMProperty.injection.HAS_POSITIVE_NUMERIC_VALUE;
var DefaultDOMPropertyConfig = {
  isCustomAttribute: RegExp.prototype.test.bind(/^(data|aria)-[a-z_][a-z\d_.\-]*$/),
  Properties: {
    accept: null,
    accessKey: null,
    action: null,
    allowFullScreen: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    allowTransparency: MUST_USE_ATTRIBUTE,
    alt: null,
    async: HAS_BOOLEAN_VALUE,
    autoComplete: null,
    autoPlay: HAS_BOOLEAN_VALUE,
    cellPadding: null,
    cellSpacing: null,
    charSet: MUST_USE_ATTRIBUTE,
    checked: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    className: MUST_USE_PROPERTY,
    cols: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    colSpan: null,
    content: null,
    contentEditable: null,
    contextMenu: MUST_USE_ATTRIBUTE,
    controls: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    crossOrigin: null,
    data: null,
    dateTime: MUST_USE_ATTRIBUTE,
    defer: HAS_BOOLEAN_VALUE,
    dir: null,
    disabled: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    download: null,
    draggable: null,
    encType: null,
    form: MUST_USE_ATTRIBUTE,
    formNoValidate: HAS_BOOLEAN_VALUE,
    frameBorder: MUST_USE_ATTRIBUTE,
    height: MUST_USE_ATTRIBUTE,
    hidden: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    href: null,
    hrefLang: null,
    htmlFor: null,
    httpEquiv: null,
    icon: null,
    id: MUST_USE_PROPERTY,
    label: null,
    lang: null,
    list: null,
    loop: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    max: null,
    maxLength: MUST_USE_ATTRIBUTE,
    mediaGroup: null,
    method: null,
    min: null,
    multiple: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    muted: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    name: null,
    noValidate: HAS_BOOLEAN_VALUE,
    pattern: null,
    placeholder: null,
    poster: null,
    preload: null,
    radioGroup: null,
    readOnly: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    rel: null,
    required: HAS_BOOLEAN_VALUE,
    role: MUST_USE_ATTRIBUTE,
    rows: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    rowSpan: null,
    sandbox: null,
    scope: null,
    scrollLeft: MUST_USE_PROPERTY,
    scrollTop: MUST_USE_PROPERTY,
    seamless: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    selected: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    size: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    span: HAS_POSITIVE_NUMERIC_VALUE,
    spellCheck: null,
    src: null,
    srcDoc: MUST_USE_PROPERTY,
    step: null,
    style: null,
    tabIndex: null,
    target: null,
    title: null,
    type: null,
    value: MUST_USE_PROPERTY | HAS_SIDE_EFFECTS,
    width: MUST_USE_ATTRIBUTE,
    wmode: MUST_USE_ATTRIBUTE,
    autoCapitalize: null,
    autoCorrect: null,
    property: null,
    cx: MUST_USE_ATTRIBUTE,
    cy: MUST_USE_ATTRIBUTE,
    d: MUST_USE_ATTRIBUTE,
    fill: MUST_USE_ATTRIBUTE,
    fx: MUST_USE_ATTRIBUTE,
    fy: MUST_USE_ATTRIBUTE,
    gradientTransform: MUST_USE_ATTRIBUTE,
    gradientUnits: MUST_USE_ATTRIBUTE,
    offset: MUST_USE_ATTRIBUTE,
    points: MUST_USE_ATTRIBUTE,
    r: MUST_USE_ATTRIBUTE,
    rx: MUST_USE_ATTRIBUTE,
    ry: MUST_USE_ATTRIBUTE,
    spreadMethod: MUST_USE_ATTRIBUTE,
    stopColor: MUST_USE_ATTRIBUTE,
    stopOpacity: MUST_USE_ATTRIBUTE,
    stroke: MUST_USE_ATTRIBUTE,
    strokeLinecap: MUST_USE_ATTRIBUTE,
    strokeWidth: MUST_USE_ATTRIBUTE,
    transform: MUST_USE_ATTRIBUTE,
    version: MUST_USE_ATTRIBUTE,
    viewBox: MUST_USE_ATTRIBUTE,
    x1: MUST_USE_ATTRIBUTE,
    x2: MUST_USE_ATTRIBUTE,
    x: MUST_USE_ATTRIBUTE,
    y1: MUST_USE_ATTRIBUTE,
    y2: MUST_USE_ATTRIBUTE,
    y: MUST_USE_ATTRIBUTE
  },
  DOMAttributeNames: {
    className: 'class',
    gradientTransform: 'gradientTransform',
    gradientUnits: 'gradientUnits',
    htmlFor: 'for',
    spreadMethod: 'spreadMethod',
    stopColor: 'stop-color',
    stopOpacity: 'stop-opacity',
    strokeLinecap: 'stroke-linecap',
    strokeWidth: 'stroke-width',
    viewBox: 'viewBox'
  },
  DOMPropertyNames: {
    autoCapitalize: 'autocapitalize',
    autoComplete: 'autocomplete',
    autoCorrect: 'autocorrect',
    autoFocus: 'autofocus',
    autoPlay: 'autoplay',
    encType: 'enctype',
    hrefLang: 'hreflang',
    radioGroup: 'radiogroup',
    spellCheck: 'spellcheck',
    srcDoc: 'srcdoc'
  },
  DOMMutationMethods: {className: function(node, value) {
      node.className = value || '';
    }}
};
module.exports = DefaultDOMPropertyConfig;


},{"./DOMProperty":22}],26:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/DefaultEventPluginOrder";
"use strict";
var keyOf = require("./keyOf");
var DefaultEventPluginOrder = [keyOf({ResponderEventPlugin: null}), keyOf({SimpleEventPlugin: null}), keyOf({TapEventPlugin: null}), keyOf({EnterLeaveEventPlugin: null}), keyOf({ChangeEventPlugin: null}), keyOf({SelectEventPlugin: null}), keyOf({CompositionEventPlugin: null}), keyOf({AnalyticsEventPlugin: null}), keyOf({MobileSafariClickEventPlugin: null})];
module.exports = DefaultEventPluginOrder;


},{"./keyOf":129}],27:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/EnterLeaveEventPlugin";
"use strict";
var EventConstants = require("./EventConstants");
var EventPropagators = require("./EventPropagators");
var SyntheticMouseEvent = require("./SyntheticMouseEvent");
var ReactMount = require("./ReactMount");
var keyOf = require("./keyOf");
var topLevelTypes = EventConstants.topLevelTypes;
var getFirstReactDOM = ReactMount.getFirstReactDOM;
var eventTypes = {
  mouseEnter: {
    registrationName: keyOf({onMouseEnter: null}),
    dependencies: [topLevelTypes.topMouseOut, topLevelTypes.topMouseOver]
  },
  mouseLeave: {
    registrationName: keyOf({onMouseLeave: null}),
    dependencies: [topLevelTypes.topMouseOut, topLevelTypes.topMouseOver]
  }
};
var extractedEvents = [null, null];
var EnterLeaveEventPlugin = {
  eventTypes: eventTypes,
  extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    if (topLevelType === topLevelTypes.topMouseOver && (nativeEvent.relatedTarget || nativeEvent.fromElement)) {
      return null;
    }
    if (topLevelType !== topLevelTypes.topMouseOut && topLevelType !== topLevelTypes.topMouseOver) {
      return null;
    }
    var win;
    if (topLevelTarget.window === topLevelTarget) {
      win = topLevelTarget;
    } else {
      var doc = topLevelTarget.ownerDocument;
      if (doc) {
        win = doc.defaultView || doc.parentWindow;
      } else {
        win = window;
      }
    }
    var from,
        to;
    if (topLevelType === topLevelTypes.topMouseOut) {
      from = topLevelTarget;
      to = getFirstReactDOM(nativeEvent.relatedTarget || nativeEvent.toElement) || win;
    } else {
      from = win;
      to = topLevelTarget;
    }
    if (from === to) {
      return null;
    }
    var fromID = from ? ReactMount.getID(from) : '';
    var toID = to ? ReactMount.getID(to) : '';
    var leave = SyntheticMouseEvent.getPooled(eventTypes.mouseLeave, fromID, nativeEvent);
    leave.type = 'mouseleave';
    leave.target = from;
    leave.relatedTarget = to;
    var enter = SyntheticMouseEvent.getPooled(eventTypes.mouseEnter, toID, nativeEvent);
    enter.type = 'mouseenter';
    enter.target = to;
    enter.relatedTarget = from;
    EventPropagators.accumulateEnterLeaveDispatches(leave, enter, fromID, toID);
    extractedEvents[0] = leave;
    extractedEvents[1] = enter;
    return extractedEvents;
  }
};
module.exports = EnterLeaveEventPlugin;


},{"./EventConstants":28,"./EventPropagators":33,"./ReactMount":69,"./SyntheticMouseEvent":94,"./keyOf":129}],28:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/EventConstants";
"use strict";
var keyMirror = require("./keyMirror");
var PropagationPhases = keyMirror({
  bubbled: null,
  captured: null
});
var topLevelTypes = keyMirror({
  topBlur: null,
  topChange: null,
  topClick: null,
  topCompositionEnd: null,
  topCompositionStart: null,
  topCompositionUpdate: null,
  topContextMenu: null,
  topCopy: null,
  topCut: null,
  topDoubleClick: null,
  topDrag: null,
  topDragEnd: null,
  topDragEnter: null,
  topDragExit: null,
  topDragLeave: null,
  topDragOver: null,
  topDragStart: null,
  topDrop: null,
  topError: null,
  topFocus: null,
  topInput: null,
  topKeyDown: null,
  topKeyPress: null,
  topKeyUp: null,
  topLoad: null,
  topMouseDown: null,
  topMouseMove: null,
  topMouseOut: null,
  topMouseOver: null,
  topMouseUp: null,
  topPaste: null,
  topReset: null,
  topScroll: null,
  topSelectionChange: null,
  topSubmit: null,
  topTouchCancel: null,
  topTouchEnd: null,
  topTouchMove: null,
  topTouchStart: null,
  topWheel: null
});
var EventConstants = {
  topLevelTypes: topLevelTypes,
  PropagationPhases: PropagationPhases
};
module.exports = EventConstants;


},{"./keyMirror":128}],29:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/EventListener";
var emptyFunction = require("./emptyFunction");
var EventListener = {
  listen: function(target, eventType, callback) {
    if (target.addEventListener) {
      target.addEventListener(eventType, callback, false);
      return {remove: function() {
          target.removeEventListener(eventType, callback, false);
        }};
    } else if (target.attachEvent) {
      target.attachEvent('on' + eventType, callback);
      return {remove: function() {
          target.detachEvent(eventType, callback);
        }};
    }
  },
  capture: function(target, eventType, callback) {
    if (!target.addEventListener) {
      if ("production" !== process.env.NODE_ENV) {
        console.error('Attempted to listen to events during the capture phase on a ' + 'browser that does not support the capture phase. Your application ' + 'will not receive some events.');
      }
      return {remove: emptyFunction};
    } else {
      target.addEventListener(eventType, callback, true);
      return {remove: function() {
          target.removeEventListener(eventType, callback, true);
        }};
    }
  }
};
module.exports = EventListener;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./emptyFunction":109,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],30:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/EventPluginHub";
"use strict";
var EventPluginRegistry = require("./EventPluginRegistry");
var EventPluginUtils = require("./EventPluginUtils");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var accumulate = require("./accumulate");
var forEachAccumulated = require("./forEachAccumulated");
var invariant = require("./invariant");
var isEventSupported = require("./isEventSupported");
var listenerBank = {};
var eventQueue = null;
var executeDispatchesAndRelease = function(event) {
  if (event) {
    var executeDispatch = EventPluginUtils.executeDispatch;
    var PluginModule = EventPluginRegistry.getPluginModuleForEvent(event);
    if (PluginModule && PluginModule.executeDispatch) {
      executeDispatch = PluginModule.executeDispatch;
    }
    EventPluginUtils.executeDispatchesInOrder(event, executeDispatch);
    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};
var InstanceHandle = null;
function validateInstanceHandle() {
  var invalid = !InstanceHandle || !InstanceHandle.traverseTwoPhase || !InstanceHandle.traverseEnterLeave;
  if (invalid) {
    throw new Error('InstanceHandle not injected before use!');
  }
}
var EventPluginHub = {
  injection: {
    injectMount: EventPluginUtils.injection.injectMount,
    injectInstanceHandle: function(InjectedInstanceHandle) {
      InstanceHandle = InjectedInstanceHandle;
      if ("production" !== process.env.NODE_ENV) {
        validateInstanceHandle();
      }
    },
    getInstanceHandle: function() {
      if ("production" !== process.env.NODE_ENV) {
        validateInstanceHandle();
      }
      return InstanceHandle;
    },
    injectEventPluginOrder: EventPluginRegistry.injectEventPluginOrder,
    injectEventPluginsByName: EventPluginRegistry.injectEventPluginsByName
  },
  eventNameDispatchConfigs: EventPluginRegistry.eventNameDispatchConfigs,
  registrationNameModules: EventPluginRegistry.registrationNameModules,
  putListener: function(id, registrationName, listener) {
    ("production" !== process.env.NODE_ENV ? invariant(ExecutionEnvironment.canUseDOM, 'Cannot call putListener() in a non-DOM environment.') : invariant(ExecutionEnvironment.canUseDOM));
    ("production" !== process.env.NODE_ENV ? invariant(!listener || typeof listener === 'function', 'Expected %s listener to be a function, instead got type %s', registrationName, typeof listener) : invariant(!listener || typeof listener === 'function'));
    if ("production" !== process.env.NODE_ENV) {
      if (registrationName === 'onScroll' && !isEventSupported('scroll', true)) {
        console.warn('This browser doesn\'t support the `onScroll` event');
      }
    }
    var bankForRegistrationName = listenerBank[registrationName] || (listenerBank[registrationName] = {});
    bankForRegistrationName[id] = listener;
  },
  getListener: function(id, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    return bankForRegistrationName && bankForRegistrationName[id];
  },
  deleteListener: function(id, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    if (bankForRegistrationName) {
      delete bankForRegistrationName[id];
    }
  },
  deleteAllListeners: function(id) {
    for (var registrationName in listenerBank) {
      delete listenerBank[registrationName][id];
    }
  },
  extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    var events;
    var plugins = EventPluginRegistry.plugins;
    for (var i = 0,
        l = plugins.length; i < l; i++) {
      var possiblePlugin = plugins[i];
      if (possiblePlugin) {
        var extractedEvents = possiblePlugin.extractEvents(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent);
        if (extractedEvents) {
          events = accumulate(events, extractedEvents);
        }
      }
    }
    return events;
  },
  enqueueEvents: function(events) {
    if (events) {
      eventQueue = accumulate(eventQueue, events);
    }
  },
  processEventQueue: function() {
    var processingEventQueue = eventQueue;
    eventQueue = null;
    forEachAccumulated(processingEventQueue, executeDispatchesAndRelease);
    ("production" !== process.env.NODE_ENV ? invariant(!eventQueue, 'processEventQueue(): Additional events were enqueued while processing ' + 'an event queue. Support for this has not yet been implemented.') : invariant(!eventQueue));
  },
  __purge: function() {
    listenerBank = {};
  },
  __getListenerBank: function() {
    return listenerBank;
  }
};
module.exports = EventPluginHub;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./EventPluginRegistry":31,"./EventPluginUtils":32,"./ExecutionEnvironment":34,"./accumulate":100,"./forEachAccumulated":112,"./invariant":122,"./isEventSupported":123,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],31:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/EventPluginRegistry";
"use strict";
var invariant = require("./invariant");
var EventPluginOrder = null;
var namesToPlugins = {};
function recomputePluginOrdering() {
  if (!EventPluginOrder) {
    return;
  }
  for (var pluginName in namesToPlugins) {
    var PluginModule = namesToPlugins[pluginName];
    var pluginIndex = EventPluginOrder.indexOf(pluginName);
    ("production" !== process.env.NODE_ENV ? invariant(pluginIndex > -1, 'EventPluginRegistry: Cannot inject event plugins that do not exist in ' + 'the plugin ordering, `%s`.', pluginName) : invariant(pluginIndex > -1));
    if (EventPluginRegistry.plugins[pluginIndex]) {
      continue;
    }
    ("production" !== process.env.NODE_ENV ? invariant(PluginModule.extractEvents, 'EventPluginRegistry: Event plugins must implement an `extractEvents` ' + 'method, but `%s` does not.', pluginName) : invariant(PluginModule.extractEvents));
    EventPluginRegistry.plugins[pluginIndex] = PluginModule;
    var publishedEvents = PluginModule.eventTypes;
    for (var eventName in publishedEvents) {
      ("production" !== process.env.NODE_ENV ? invariant(publishEventForPlugin(publishedEvents[eventName], PluginModule, eventName), 'EventPluginRegistry: Failed to publish event `%s` for plugin `%s`.', eventName, pluginName) : invariant(publishEventForPlugin(publishedEvents[eventName], PluginModule, eventName)));
    }
  }
}
function publishEventForPlugin(dispatchConfig, PluginModule, eventName) {
  ("production" !== process.env.NODE_ENV ? invariant(!EventPluginRegistry.eventNameDispatchConfigs[eventName], 'EventPluginHub: More than one plugin attempted to publish the same ' + 'event name, `%s`.', eventName) : invariant(!EventPluginRegistry.eventNameDispatchConfigs[eventName]));
  EventPluginRegistry.eventNameDispatchConfigs[eventName] = dispatchConfig;
  var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
  if (phasedRegistrationNames) {
    for (var phaseName in phasedRegistrationNames) {
      if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
        var phasedRegistrationName = phasedRegistrationNames[phaseName];
        publishRegistrationName(phasedRegistrationName, PluginModule, eventName);
      }
    }
    return true;
  } else if (dispatchConfig.registrationName) {
    publishRegistrationName(dispatchConfig.registrationName, PluginModule, eventName);
    return true;
  }
  return false;
}
function publishRegistrationName(registrationName, PluginModule, eventName) {
  ("production" !== process.env.NODE_ENV ? invariant(!EventPluginRegistry.registrationNameModules[registrationName], 'EventPluginHub: More than one plugin attempted to publish the same ' + 'registration name, `%s`.', registrationName) : invariant(!EventPluginRegistry.registrationNameModules[registrationName]));
  EventPluginRegistry.registrationNameModules[registrationName] = PluginModule;
  EventPluginRegistry.registrationNameDependencies[registrationName] = PluginModule.eventTypes[eventName].dependencies;
}
var EventPluginRegistry = {
  plugins: [],
  eventNameDispatchConfigs: {},
  registrationNameModules: {},
  registrationNameDependencies: {},
  injectEventPluginOrder: function(InjectedEventPluginOrder) {
    ("production" !== process.env.NODE_ENV ? invariant(!EventPluginOrder, 'EventPluginRegistry: Cannot inject event plugin ordering more than once.') : invariant(!EventPluginOrder));
    EventPluginOrder = Array.prototype.slice.call(InjectedEventPluginOrder);
    recomputePluginOrdering();
  },
  injectEventPluginsByName: function(injectedNamesToPlugins) {
    var isOrderingDirty = false;
    for (var pluginName in injectedNamesToPlugins) {
      if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
        continue;
      }
      var PluginModule = injectedNamesToPlugins[pluginName];
      if (namesToPlugins[pluginName] !== PluginModule) {
        ("production" !== process.env.NODE_ENV ? invariant(!namesToPlugins[pluginName], 'EventPluginRegistry: Cannot inject two different event plugins ' + 'using the same name, `%s`.', pluginName) : invariant(!namesToPlugins[pluginName]));
        namesToPlugins[pluginName] = PluginModule;
        isOrderingDirty = true;
      }
    }
    if (isOrderingDirty) {
      recomputePluginOrdering();
    }
  },
  getPluginModuleForEvent: function(event) {
    var dispatchConfig = event.dispatchConfig;
    if (dispatchConfig.registrationName) {
      return EventPluginRegistry.registrationNameModules[dispatchConfig.registrationName] || null;
    }
    for (var phase in dispatchConfig.phasedRegistrationNames) {
      if (!dispatchConfig.phasedRegistrationNames.hasOwnProperty(phase)) {
        continue;
      }
      var PluginModule = EventPluginRegistry.registrationNameModules[dispatchConfig.phasedRegistrationNames[phase]];
      if (PluginModule) {
        return PluginModule;
      }
    }
    return null;
  },
  _resetEventPlugins: function() {
    EventPluginOrder = null;
    for (var pluginName in namesToPlugins) {
      if (namesToPlugins.hasOwnProperty(pluginName)) {
        delete namesToPlugins[pluginName];
      }
    }
    EventPluginRegistry.plugins.length = 0;
    var eventNameDispatchConfigs = EventPluginRegistry.eventNameDispatchConfigs;
    for (var eventName in eventNameDispatchConfigs) {
      if (eventNameDispatchConfigs.hasOwnProperty(eventName)) {
        delete eventNameDispatchConfigs[eventName];
      }
    }
    var registrationNameModules = EventPluginRegistry.registrationNameModules;
    for (var registrationName in registrationNameModules) {
      if (registrationNameModules.hasOwnProperty(registrationName)) {
        delete registrationNameModules[registrationName];
      }
    }
  }
};
module.exports = EventPluginRegistry;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],32:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/EventPluginUtils";
"use strict";
var EventConstants = require("./EventConstants");
var invariant = require("./invariant");
var injection = {
  Mount: null,
  injectMount: function(InjectedMount) {
    injection.Mount = InjectedMount;
    if ("production" !== process.env.NODE_ENV) {
      ("production" !== process.env.NODE_ENV ? invariant(InjectedMount && InjectedMount.getNode, 'EventPluginUtils.injection.injectMount(...): Injected Mount module ' + 'is missing getNode.') : invariant(InjectedMount && InjectedMount.getNode));
    }
  }
};
var topLevelTypes = EventConstants.topLevelTypes;
function isEndish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseUp || topLevelType === topLevelTypes.topTouchEnd || topLevelType === topLevelTypes.topTouchCancel;
}
function isMoveish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseMove || topLevelType === topLevelTypes.topTouchMove;
}
function isStartish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseDown || topLevelType === topLevelTypes.topTouchStart;
}
var validateEventDispatches;
if ("production" !== process.env.NODE_ENV) {
  validateEventDispatches = function(event) {
    var dispatchListeners = event._dispatchListeners;
    var dispatchIDs = event._dispatchIDs;
    var listenersIsArr = Array.isArray(dispatchListeners);
    var idsIsArr = Array.isArray(dispatchIDs);
    var IDsLen = idsIsArr ? dispatchIDs.length : dispatchIDs ? 1 : 0;
    var listenersLen = listenersIsArr ? dispatchListeners.length : dispatchListeners ? 1 : 0;
    ("production" !== process.env.NODE_ENV ? invariant(idsIsArr === listenersIsArr && IDsLen === listenersLen, 'EventPluginUtils: Invalid `event`.') : invariant(idsIsArr === listenersIsArr && IDsLen === listenersLen));
  };
}
function forEachEventDispatch(event, cb) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== process.env.NODE_ENV) {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      cb(event, dispatchListeners[i], dispatchIDs[i]);
    }
  } else if (dispatchListeners) {
    cb(event, dispatchListeners, dispatchIDs);
  }
}
function executeDispatch(event, listener, domID) {
  event.currentTarget = injection.Mount.getNode(domID);
  var returnValue = listener(event, domID);
  event.currentTarget = null;
  return returnValue;
}
function executeDispatchesInOrder(event, executeDispatch) {
  forEachEventDispatch(event, executeDispatch);
  event._dispatchListeners = null;
  event._dispatchIDs = null;
}
function executeDispatchesInOrderStopAtTrue(event) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== process.env.NODE_ENV) {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      if (dispatchListeners[i](event, dispatchIDs[i])) {
        return dispatchIDs[i];
      }
    }
  } else if (dispatchListeners) {
    if (dispatchListeners(event, dispatchIDs)) {
      return dispatchIDs;
    }
  }
  return null;
}
function executeDirectDispatch(event) {
  if ("production" !== process.env.NODE_ENV) {
    validateEventDispatches(event);
  }
  var dispatchListener = event._dispatchListeners;
  var dispatchID = event._dispatchIDs;
  ("production" !== process.env.NODE_ENV ? invariant(!Array.isArray(dispatchListener), 'executeDirectDispatch(...): Invalid `event`.') : invariant(!Array.isArray(dispatchListener)));
  var res = dispatchListener ? dispatchListener(event, dispatchID) : null;
  event._dispatchListeners = null;
  event._dispatchIDs = null;
  return res;
}
function hasDispatches(event) {
  return !!event._dispatchListeners;
}
var EventPluginUtils = {
  isEndish: isEndish,
  isMoveish: isMoveish,
  isStartish: isStartish,
  executeDirectDispatch: executeDirectDispatch,
  executeDispatch: executeDispatch,
  executeDispatchesInOrder: executeDispatchesInOrder,
  executeDispatchesInOrderStopAtTrue: executeDispatchesInOrderStopAtTrue,
  hasDispatches: hasDispatches,
  injection: injection,
  useTouchEvents: false
};
module.exports = EventPluginUtils;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./EventConstants":28,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],33:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/EventPropagators";
"use strict";
var EventConstants = require("./EventConstants");
var EventPluginHub = require("./EventPluginHub");
var accumulate = require("./accumulate");
var forEachAccumulated = require("./forEachAccumulated");
var PropagationPhases = EventConstants.PropagationPhases;
var getListener = EventPluginHub.getListener;
function listenerAtPhase(id, event, propagationPhase) {
  var registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(id, registrationName);
}
function accumulateDirectionalDispatches(domID, upwards, event) {
  if ("production" !== process.env.NODE_ENV) {
    if (!domID) {
      throw new Error('Dispatching id must not be null');
    }
  }
  var phase = upwards ? PropagationPhases.bubbled : PropagationPhases.captured;
  var listener = listenerAtPhase(domID, event, phase);
  if (listener) {
    event._dispatchListeners = accumulate(event._dispatchListeners, listener);
    event._dispatchIDs = accumulate(event._dispatchIDs, domID);
  }
}
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    EventPluginHub.injection.getInstanceHandle().traverseTwoPhase(event.dispatchMarker, accumulateDirectionalDispatches, event);
  }
}
function accumulateDispatches(id, ignoredDirection, event) {
  if (event && event.dispatchConfig.registrationName) {
    var registrationName = event.dispatchConfig.registrationName;
    var listener = getListener(id, registrationName);
    if (listener) {
      event._dispatchListeners = accumulate(event._dispatchListeners, listener);
      event._dispatchIDs = accumulate(event._dispatchIDs, id);
    }
  }
}
function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event.dispatchMarker, null, event);
  }
}
function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}
function accumulateEnterLeaveDispatches(leave, enter, fromID, toID) {
  EventPluginHub.injection.getInstanceHandle().traverseEnterLeave(fromID, toID, accumulateDispatches, leave, enter);
}
function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}
var EventPropagators = {
  accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
  accumulateDirectDispatches: accumulateDirectDispatches,
  accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches
};
module.exports = EventPropagators;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./EventConstants":28,"./EventPluginHub":30,"./accumulate":100,"./forEachAccumulated":112,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],34:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ExecutionEnvironment";
"use strict";
var canUseDOM = typeof window !== 'undefined';
var ExecutionEnvironment = {
  canUseDOM: canUseDOM,
  canUseWorkers: typeof Worker !== 'undefined',
  canUseEventListeners: canUseDOM && (window.addEventListener || window.attachEvent),
  isInWorker: !canUseDOM
};
module.exports = ExecutionEnvironment;


},{}],35:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/LinkedValueUtils";
"use strict";
var ReactPropTypes = require("./ReactPropTypes");
var invariant = require("./invariant");
var hasReadOnlyValue = {
  'button': true,
  'checkbox': true,
  'image': true,
  'hidden': true,
  'radio': true,
  'reset': true,
  'submit': true
};
function _assertSingleLink(input) {
  ("production" !== process.env.NODE_ENV ? invariant(input.props.checkedLink == null || input.props.valueLink == null, 'Cannot provide a checkedLink and a valueLink. If you want to use ' + 'checkedLink, you probably don\'t want to use valueLink and vice versa.') : invariant(input.props.checkedLink == null || input.props.valueLink == null));
}
function _assertValueLink(input) {
  _assertSingleLink(input);
  ("production" !== process.env.NODE_ENV ? invariant(input.props.value == null && input.props.onChange == null, 'Cannot provide a valueLink and a value or onChange event. If you want ' + 'to use value or onChange, you probably don\'t want to use valueLink.') : invariant(input.props.value == null && input.props.onChange == null));
}
function _assertCheckedLink(input) {
  _assertSingleLink(input);
  ("production" !== process.env.NODE_ENV ? invariant(input.props.checked == null && input.props.onChange == null, 'Cannot provide a checkedLink and a checked property or onChange event. ' + 'If you want to use checked or onChange, you probably don\'t want to ' + 'use checkedLink') : invariant(input.props.checked == null && input.props.onChange == null));
}
function _handleLinkedValueChange(e) {
  this.props.valueLink.requestChange(e.target.value);
}
function _handleLinkedCheckChange(e) {
  this.props.checkedLink.requestChange(e.target.checked);
}
var LinkedValueUtils = {
  Mixin: {propTypes: {
      value: function(props, propName, componentName) {
        if ("production" !== process.env.NODE_ENV) {
          if (props[propName] && !hasReadOnlyValue[props.type] && !props.onChange && !props.readOnly && !props.disabled) {
            console.warn('You provided a `value` prop to a form field without an ' + '`onChange` handler. This will render a read-only field. If ' + 'the field should be mutable use `defaultValue`. Otherwise, ' + 'set either `onChange` or `readOnly`.');
          }
        }
      },
      checked: function(props, propName, componentName) {
        if ("production" !== process.env.NODE_ENV) {
          if (props[propName] && !props.onChange && !props.readOnly && !props.disabled) {
            console.warn('You provided a `checked` prop to a form field without an ' + '`onChange` handler. This will render a read-only field. If ' + 'the field should be mutable use `defaultChecked`. Otherwise, ' + 'set either `onChange` or `readOnly`.');
          }
        }
      },
      onChange: ReactPropTypes.func
    }},
  getValue: function(input) {
    if (input.props.valueLink) {
      _assertValueLink(input);
      return input.props.valueLink.value;
    }
    return input.props.value;
  },
  getChecked: function(input) {
    if (input.props.checkedLink) {
      _assertCheckedLink(input);
      return input.props.checkedLink.value;
    }
    return input.props.checked;
  },
  getOnChange: function(input) {
    if (input.props.valueLink) {
      _assertValueLink(input);
      return _handleLinkedValueChange;
    } else if (input.props.checkedLink) {
      _assertCheckedLink(input);
      return _handleLinkedCheckChange;
    }
    return input.props.onChange;
  }
};
module.exports = LinkedValueUtils;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactPropTypes":78,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],36:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/MobileSafariClickEventPlugin";
"use strict";
var EventConstants = require("./EventConstants");
var emptyFunction = require("./emptyFunction");
var topLevelTypes = EventConstants.topLevelTypes;
var MobileSafariClickEventPlugin = {
  eventTypes: null,
  extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    if (topLevelType === topLevelTypes.topTouchStart) {
      var target = nativeEvent.target;
      if (target && !target.onclick) {
        target.onclick = emptyFunction;
      }
    }
  }
};
module.exports = MobileSafariClickEventPlugin;


},{"./EventConstants":28,"./emptyFunction":109}],37:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/PooledClass";
"use strict";
var invariant = require("./invariant");
var oneArgumentPooler = function(copyFieldsFrom) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, copyFieldsFrom);
    return instance;
  } else {
    return new Klass(copyFieldsFrom);
  }
};
var twoArgumentPooler = function(a1, a2) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2);
    return instance;
  } else {
    return new Klass(a1, a2);
  }
};
var threeArgumentPooler = function(a1, a2, a3) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3);
    return instance;
  } else {
    return new Klass(a1, a2, a3);
  }
};
var fiveArgumentPooler = function(a1, a2, a3, a4, a5) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4, a5);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4, a5);
  }
};
var standardReleaser = function(instance) {
  var Klass = this;
  ("production" !== process.env.NODE_ENV ? invariant(instance instanceof Klass, 'Trying to release an instance into a pool of a different type.') : invariant(instance instanceof Klass));
  if (instance.destructor) {
    instance.destructor();
  }
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};
var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;
var addPoolingTo = function(CopyConstructor, pooler) {
  var NewKlass = CopyConstructor;
  NewKlass.instancePool = [];
  NewKlass.getPooled = pooler || DEFAULT_POOLER;
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE;
  }
  NewKlass.release = standardReleaser;
  return NewKlass;
};
var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: oneArgumentPooler,
  twoArgumentPooler: twoArgumentPooler,
  threeArgumentPooler: threeArgumentPooler,
  fiveArgumentPooler: fiveArgumentPooler
};
module.exports = PooledClass;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],38:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/React";
"use strict";
var DOMPropertyOperations = require("./DOMPropertyOperations");
var EventPluginUtils = require("./EventPluginUtils");
var ReactChildren = require("./ReactChildren");
var ReactComponent = require("./ReactComponent");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactContext = require("./ReactContext");
var ReactCurrentOwner = require("./ReactCurrentOwner");
var ReactDOM = require("./ReactDOM");
var ReactDOMComponent = require("./ReactDOMComponent");
var ReactDefaultInjection = require("./ReactDefaultInjection");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactMount = require("./ReactMount");
var ReactMultiChild = require("./ReactMultiChild");
var ReactPerf = require("./ReactPerf");
var ReactPropTypes = require("./ReactPropTypes");
var ReactServerRendering = require("./ReactServerRendering");
var ReactTextComponent = require("./ReactTextComponent");
var onlyChild = require("./onlyChild");
ReactDefaultInjection.inject();
var React = {
  Children: {
    map: ReactChildren.map,
    forEach: ReactChildren.forEach,
    only: onlyChild
  },
  DOM: ReactDOM,
  PropTypes: ReactPropTypes,
  initializeTouchEvents: function(shouldUseTouch) {
    EventPluginUtils.useTouchEvents = shouldUseTouch;
  },
  createClass: ReactCompositeComponent.createClass,
  constructAndRenderComponent: ReactMount.constructAndRenderComponent,
  constructAndRenderComponentByID: ReactMount.constructAndRenderComponentByID,
  renderComponent: ReactPerf.measure('React', 'renderComponent', ReactMount.renderComponent),
  renderComponentToString: ReactServerRendering.renderComponentToString,
  unmountComponentAtNode: ReactMount.unmountComponentAtNode,
  isValidClass: ReactCompositeComponent.isValidClass,
  isValidComponent: ReactComponent.isValidComponent,
  withContext: ReactContext.withContext,
  __internals: {
    Component: ReactComponent,
    CurrentOwner: ReactCurrentOwner,
    DOMComponent: ReactDOMComponent,
    DOMPropertyOperations: DOMPropertyOperations,
    InstanceHandles: ReactInstanceHandles,
    Mount: ReactMount,
    MultiChild: ReactMultiChild,
    TextComponent: ReactTextComponent
  }
};
if ("production" !== process.env.NODE_ENV) {
  var ExecutionEnvironment = require("./ExecutionEnvironment");
  if (ExecutionEnvironment.canUseDOM && window.top === window.self && navigator.userAgent.indexOf('Chrome') > -1) {
    console.debug('Download the React DevTools for a better development experience: ' + 'http://fb.me/react-devtools');
  }
}
React.version = '0.9.0';
module.exports = React;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./DOMPropertyOperations":23,"./EventPluginUtils":32,"./ExecutionEnvironment":34,"./ReactChildren":39,"./ReactComponent":40,"./ReactCompositeComponent":43,"./ReactContext":44,"./ReactCurrentOwner":45,"./ReactDOM":46,"./ReactDOMComponent":48,"./ReactDefaultInjection":58,"./ReactInstanceHandles":67,"./ReactMount":69,"./ReactMultiChild":71,"./ReactPerf":74,"./ReactPropTypes":78,"./ReactServerRendering":82,"./ReactTextComponent":83,"./onlyChild":137,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],39:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactChildren";
"use strict";
var PooledClass = require("./PooledClass");
var invariant = require("./invariant");
var traverseAllChildren = require("./traverseAllChildren");
var twoArgumentPooler = PooledClass.twoArgumentPooler;
var threeArgumentPooler = PooledClass.threeArgumentPooler;
function ForEachBookKeeping(forEachFunction, forEachContext) {
  this.forEachFunction = forEachFunction;
  this.forEachContext = forEachContext;
}
PooledClass.addPoolingTo(ForEachBookKeeping, twoArgumentPooler);
function forEachSingleChild(traverseContext, child, name, i) {
  var forEachBookKeeping = traverseContext;
  forEachBookKeeping.forEachFunction.call(forEachBookKeeping.forEachContext, child, i);
}
function forEachChildren(children, forEachFunc, forEachContext) {
  if (children == null) {
    return children;
  }
  var traverseContext = ForEachBookKeeping.getPooled(forEachFunc, forEachContext);
  traverseAllChildren(children, forEachSingleChild, traverseContext);
  ForEachBookKeeping.release(traverseContext);
}
function MapBookKeeping(mapResult, mapFunction, mapContext) {
  this.mapResult = mapResult;
  this.mapFunction = mapFunction;
  this.mapContext = mapContext;
}
PooledClass.addPoolingTo(MapBookKeeping, threeArgumentPooler);
function mapSingleChildIntoContext(traverseContext, child, name, i) {
  var mapBookKeeping = traverseContext;
  var mapResult = mapBookKeeping.mapResult;
  var mappedChild = mapBookKeeping.mapFunction.call(mapBookKeeping.mapContext, child, i);
  ("production" !== process.env.NODE_ENV ? invariant(!mapResult.hasOwnProperty(name), 'ReactChildren.map(...): Encountered two children with the same key, ' + '`%s`. Children keys must be unique.', name) : invariant(!mapResult.hasOwnProperty(name)));
  mapResult[name] = mappedChild;
}
function mapChildren(children, func, context) {
  if (children == null) {
    return children;
  }
  var mapResult = {};
  var traverseContext = MapBookKeeping.getPooled(mapResult, func, context);
  traverseAllChildren(children, mapSingleChildIntoContext, traverseContext);
  MapBookKeeping.release(traverseContext);
  return mapResult;
}
var ReactChildren = {
  forEach: forEachChildren,
  map: mapChildren
};
module.exports = ReactChildren;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./PooledClass":37,"./invariant":122,"./traverseAllChildren":142,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],40:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactComponent";
"use strict";
var ReactComponentEnvironment = require("./ReactComponentEnvironment");
var ReactCurrentOwner = require("./ReactCurrentOwner");
var ReactOwner = require("./ReactOwner");
var ReactUpdates = require("./ReactUpdates");
var invariant = require("./invariant");
var keyMirror = require("./keyMirror");
var merge = require("./merge");
var ComponentLifeCycle = keyMirror({
  MOUNTED: null,
  UNMOUNTED: null
});
var ownerHasExplicitKeyWarning = {};
var ownerHasPropertyWarning = {};
var NUMERIC_PROPERTY_REGEX = /^\d+$/;
function validateExplicitKey(component) {
  if (component.__keyValidated__ || component.props.key != null) {
    return;
  }
  component.__keyValidated__ = true;
  if (!ReactCurrentOwner.current) {
    return;
  }
  var currentName = ReactCurrentOwner.current.constructor.displayName;
  if (ownerHasExplicitKeyWarning.hasOwnProperty(currentName)) {
    return;
  }
  ownerHasExplicitKeyWarning[currentName] = true;
  var message = 'Each child in an array should have a unique "key" prop. ' + 'Check the render method of ' + currentName + '.';
  if (!component.isOwnedBy(ReactCurrentOwner.current)) {
    var childOwnerName = component._owner && component._owner.constructor.displayName;
    message += ' It was passed a child from ' + childOwnerName + '.';
  }
  message += ' See http://fb.me/react-warning-keys for more information.';
  console.warn(message);
}
function validatePropertyKey(name) {
  if (NUMERIC_PROPERTY_REGEX.test(name)) {
    var currentName = ReactCurrentOwner.current.constructor.displayName;
    if (ownerHasPropertyWarning.hasOwnProperty(currentName)) {
      return;
    }
    ownerHasPropertyWarning[currentName] = true;
    console.warn('Child objects should have non-numeric keys so ordering is preserved. ' + 'Check the render method of ' + currentName + '. ' + 'See http://fb.me/react-warning-keys for more information.');
  }
}
function validateChildKeys(component) {
  if (Array.isArray(component)) {
    for (var i = 0; i < component.length; i++) {
      var child = component[i];
      if (ReactComponent.isValidComponent(child)) {
        validateExplicitKey(child);
      }
    }
  } else if (ReactComponent.isValidComponent(component)) {
    component.__keyValidated__ = true;
  } else if (component && typeof component === 'object') {
    for (var name in component) {
      validatePropertyKey(name, component);
    }
  }
}
var ReactComponent = {
  isValidComponent: function(object) {
    if (!object || !object.type || !object.type.prototype) {
      return false;
    }
    var prototype = object.type.prototype;
    return (typeof prototype.mountComponentIntoNode === 'function' && typeof prototype.receiveComponent === 'function');
  },
  LifeCycle: ComponentLifeCycle,
  BackendIDOperations: ReactComponentEnvironment.BackendIDOperations,
  unmountIDFromEnvironment: ReactComponentEnvironment.unmountIDFromEnvironment,
  mountImageIntoNode: ReactComponentEnvironment.mountImageIntoNode,
  ReactReconcileTransaction: ReactComponentEnvironment.ReactReconcileTransaction,
  Mixin: merge(ReactComponentEnvironment.Mixin, {
    isMounted: function() {
      return this._lifeCycleState === ComponentLifeCycle.MOUNTED;
    },
    setProps: function(partialProps, callback) {
      this.replaceProps(merge(this._pendingProps || this.props, partialProps), callback);
    },
    replaceProps: function(props, callback) {
      ("production" !== process.env.NODE_ENV ? invariant(this.isMounted(), 'replaceProps(...): Can only update a mounted component.') : invariant(this.isMounted()));
      ("production" !== process.env.NODE_ENV ? invariant(this._mountDepth === 0, 'replaceProps(...): You called `setProps` or `replaceProps` on a ' + 'component with a parent. This is an anti-pattern since props will ' + 'get reactively updated when rendered. Instead, change the owner\'s ' + '`render` method to pass the correct value as props to the component ' + 'where it is created.') : invariant(this._mountDepth === 0));
      this._pendingProps = props;
      ReactUpdates.enqueueUpdate(this, callback);
    },
    construct: function(initialProps, children) {
      this.props = initialProps || {};
      this._owner = ReactCurrentOwner.current;
      this._lifeCycleState = ComponentLifeCycle.UNMOUNTED;
      this._pendingProps = null;
      this._pendingCallbacks = null;
      this._pendingOwner = this._owner;
      var childrenLength = arguments.length - 1;
      if (childrenLength === 1) {
        if ("production" !== process.env.NODE_ENV) {
          validateChildKeys(children);
        }
        this.props.children = children;
      } else if (childrenLength > 1) {
        var childArray = Array(childrenLength);
        for (var i = 0; i < childrenLength; i++) {
          if ("production" !== process.env.NODE_ENV) {
            validateChildKeys(arguments[i + 1]);
          }
          childArray[i] = arguments[i + 1];
        }
        this.props.children = childArray;
      }
    },
    mountComponent: function(rootID, transaction, mountDepth) {
      ("production" !== process.env.NODE_ENV ? invariant(!this.isMounted(), 'mountComponent(%s, ...): Can only mount an unmounted component. ' + 'Make sure to avoid storing components between renders or reusing a ' + 'single component instance in multiple places.', rootID) : invariant(!this.isMounted()));
      var props = this.props;
      if (props.ref != null) {
        ReactOwner.addComponentAsRefTo(this, props.ref, this._owner);
      }
      this._rootNodeID = rootID;
      this._lifeCycleState = ComponentLifeCycle.MOUNTED;
      this._mountDepth = mountDepth;
    },
    unmountComponent: function() {
      ("production" !== process.env.NODE_ENV ? invariant(this.isMounted(), 'unmountComponent(): Can only unmount a mounted component.') : invariant(this.isMounted()));
      var props = this.props;
      if (props.ref != null) {
        ReactOwner.removeComponentAsRefFrom(this, props.ref, this._owner);
      }
      ReactComponent.unmountIDFromEnvironment(this._rootNodeID);
      this._rootNodeID = null;
      this._lifeCycleState = ComponentLifeCycle.UNMOUNTED;
    },
    receiveComponent: function(nextComponent, transaction) {
      ("production" !== process.env.NODE_ENV ? invariant(this.isMounted(), 'receiveComponent(...): Can only update a mounted component.') : invariant(this.isMounted()));
      this._pendingOwner = nextComponent._owner;
      this._pendingProps = nextComponent.props;
      this._performUpdateIfNecessary(transaction);
    },
    performUpdateIfNecessary: function() {
      var transaction = ReactComponent.ReactReconcileTransaction.getPooled();
      transaction.perform(this._performUpdateIfNecessary, this, transaction);
      ReactComponent.ReactReconcileTransaction.release(transaction);
    },
    _performUpdateIfNecessary: function(transaction) {
      if (this._pendingProps == null) {
        return;
      }
      var prevProps = this.props;
      var prevOwner = this._owner;
      this.props = this._pendingProps;
      this._owner = this._pendingOwner;
      this._pendingProps = null;
      this.updateComponent(transaction, prevProps, prevOwner);
    },
    updateComponent: function(transaction, prevProps, prevOwner) {
      var props = this.props;
      if (this._owner !== prevOwner || props.ref !== prevProps.ref) {
        if (prevProps.ref != null) {
          ReactOwner.removeComponentAsRefFrom(this, prevProps.ref, prevOwner);
        }
        if (props.ref != null) {
          ReactOwner.addComponentAsRefTo(this, props.ref, this._owner);
        }
      }
    },
    mountComponentIntoNode: function(rootID, container, shouldReuseMarkup) {
      var transaction = ReactComponent.ReactReconcileTransaction.getPooled();
      transaction.perform(this._mountComponentIntoNode, this, rootID, container, transaction, shouldReuseMarkup);
      ReactComponent.ReactReconcileTransaction.release(transaction);
    },
    _mountComponentIntoNode: function(rootID, container, transaction, shouldReuseMarkup) {
      var markup = this.mountComponent(rootID, transaction, 0);
      ReactComponent.mountImageIntoNode(markup, container, shouldReuseMarkup);
    },
    isOwnedBy: function(owner) {
      return this._owner === owner;
    },
    getSiblingByRef: function(ref) {
      var owner = this._owner;
      if (!owner || !owner.refs) {
        return null;
      }
      return owner.refs[ref];
    }
  })
};
module.exports = ReactComponent;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactComponentEnvironment":42,"./ReactCurrentOwner":45,"./ReactOwner":73,"./ReactUpdates":84,"./invariant":122,"./keyMirror":128,"./merge":131,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],41:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactComponentBrowserEnvironment";
"use strict";
var ReactDOMIDOperations = require("./ReactDOMIDOperations");
var ReactMarkupChecksum = require("./ReactMarkupChecksum");
var ReactMount = require("./ReactMount");
var ReactPerf = require("./ReactPerf");
var ReactReconcileTransaction = require("./ReactReconcileTransaction");
var getReactRootElementInContainer = require("./getReactRootElementInContainer");
var invariant = require("./invariant");
var ELEMENT_NODE_TYPE = 1;
var DOC_NODE_TYPE = 9;
var ReactComponentBrowserEnvironment = {
  Mixin: {getDOMNode: function() {
      ("production" !== process.env.NODE_ENV ? invariant(this.isMounted(), 'getDOMNode(): A component must be mounted to have a DOM node.') : invariant(this.isMounted()));
      return ReactMount.getNode(this._rootNodeID);
    }},
  ReactReconcileTransaction: ReactReconcileTransaction,
  BackendIDOperations: ReactDOMIDOperations,
  unmountIDFromEnvironment: function(rootNodeID) {
    ReactMount.purgeID(rootNodeID);
  },
  mountImageIntoNode: ReactPerf.measure('ReactComponentBrowserEnvironment', 'mountImageIntoNode', function(markup, container, shouldReuseMarkup) {
    ("production" !== process.env.NODE_ENV ? invariant(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE), 'mountComponentIntoNode(...): Target container is not valid.') : invariant(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)));
    if (shouldReuseMarkup) {
      if (ReactMarkupChecksum.canReuseMarkup(markup, getReactRootElementInContainer(container))) {
        return;
      } else {
        ("production" !== process.env.NODE_ENV ? invariant(container.nodeType !== DOC_NODE_TYPE, 'You\'re trying to render a component to the document using ' + 'server rendering but the checksum was invalid. This usually ' + 'means you rendered a different component type or props on ' + 'the client from the one on the server, or your render() ' + 'methods are impure. React cannot handle this case due to ' + 'cross-browser quirks by rendering at the document root. You ' + 'should look for environment dependent code in your components ' + 'and ensure the props are the same client and server side.') : invariant(container.nodeType !== DOC_NODE_TYPE));
        if ("production" !== process.env.NODE_ENV) {
          console.warn('React attempted to use reuse markup in a container but the ' + 'checksum was invalid. This generally means that you are ' + 'using server rendering and the markup generated on the ' + 'server was not what the client was expecting. React injected' + 'new markup to compensate which works but you have lost many ' + 'of the benefits of server rendering. Instead, figure out ' + 'why the markup being generated is different on the client ' + 'or server.');
        }
      }
    }
    ("production" !== process.env.NODE_ENV ? invariant(container.nodeType !== DOC_NODE_TYPE, 'You\'re trying to render a component to the document but ' + 'you didn\'t use server rendering. We can\'t do this ' + 'without using server rendering due to cross-browser quirks. ' + 'See renderComponentToString() for server rendering.') : invariant(container.nodeType !== DOC_NODE_TYPE));
    var parent = container.parentNode;
    if (parent) {
      var next = container.nextSibling;
      parent.removeChild(container);
      container.innerHTML = markup;
      if (next) {
        parent.insertBefore(container, next);
      } else {
        parent.appendChild(container);
      }
    } else {
      container.innerHTML = markup;
    }
  })
};
module.exports = ReactComponentBrowserEnvironment;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactDOMIDOperations":50,"./ReactMarkupChecksum":68,"./ReactMount":69,"./ReactPerf":74,"./ReactReconcileTransaction":80,"./getReactRootElementInContainer":118,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],42:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactComponentEnvironment";
"use strict";
var ReactComponentBrowserEnvironment = require("./ReactComponentBrowserEnvironment");
var ReactComponentEnvironment = ReactComponentBrowserEnvironment;
module.exports = ReactComponentEnvironment;


},{"./ReactComponentBrowserEnvironment":41}],43:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactCompositeComponent";
"use strict";
var ReactComponent = require("./ReactComponent");
var ReactContext = require("./ReactContext");
var ReactCurrentOwner = require("./ReactCurrentOwner");
var ReactErrorUtils = require("./ReactErrorUtils");
var ReactOwner = require("./ReactOwner");
var ReactPerf = require("./ReactPerf");
var ReactPropTransferer = require("./ReactPropTransferer");
var ReactPropTypeLocations = require("./ReactPropTypeLocations");
var ReactPropTypeLocationNames = require("./ReactPropTypeLocationNames");
var ReactUpdates = require("./ReactUpdates");
var invariant = require("./invariant");
var keyMirror = require("./keyMirror");
var merge = require("./merge");
var mixInto = require("./mixInto");
var objMap = require("./objMap");
var shouldUpdateReactComponent = require("./shouldUpdateReactComponent");
var SpecPolicy = keyMirror({
  DEFINE_ONCE: null,
  DEFINE_MANY: null,
  OVERRIDE_BASE: null,
  DEFINE_MANY_MERGED: null
});
var ReactCompositeComponentInterface = {
  mixins: SpecPolicy.DEFINE_MANY,
  statics: SpecPolicy.DEFINE_MANY,
  propTypes: SpecPolicy.DEFINE_MANY,
  contextTypes: SpecPolicy.DEFINE_MANY,
  childContextTypes: SpecPolicy.DEFINE_MANY,
  getDefaultProps: SpecPolicy.DEFINE_MANY_MERGED,
  getInitialState: SpecPolicy.DEFINE_MANY_MERGED,
  getChildContext: SpecPolicy.DEFINE_MANY_MERGED,
  render: SpecPolicy.DEFINE_ONCE,
  componentWillMount: SpecPolicy.DEFINE_MANY,
  componentDidMount: SpecPolicy.DEFINE_MANY,
  componentWillReceiveProps: SpecPolicy.DEFINE_MANY,
  shouldComponentUpdate: SpecPolicy.DEFINE_ONCE,
  componentWillUpdate: SpecPolicy.DEFINE_MANY,
  componentDidUpdate: SpecPolicy.DEFINE_MANY,
  componentWillUnmount: SpecPolicy.DEFINE_MANY,
  updateComponent: SpecPolicy.OVERRIDE_BASE
};
var RESERVED_SPEC_KEYS = {
  displayName: function(ConvenienceConstructor, displayName) {
    ConvenienceConstructor.componentConstructor.displayName = displayName;
  },
  mixins: function(ConvenienceConstructor, mixins) {
    if (mixins) {
      for (var i = 0; i < mixins.length; i++) {
        mixSpecIntoComponent(ConvenienceConstructor, mixins[i]);
      }
    }
  },
  childContextTypes: function(ConvenienceConstructor, childContextTypes) {
    var Constructor = ConvenienceConstructor.componentConstructor;
    validateTypeDef(Constructor, childContextTypes, ReactPropTypeLocations.childContext);
    Constructor.childContextTypes = merge(Constructor.childContextTypes, childContextTypes);
  },
  contextTypes: function(ConvenienceConstructor, contextTypes) {
    var Constructor = ConvenienceConstructor.componentConstructor;
    validateTypeDef(Constructor, contextTypes, ReactPropTypeLocations.context);
    Constructor.contextTypes = merge(Constructor.contextTypes, contextTypes);
  },
  propTypes: function(ConvenienceConstructor, propTypes) {
    var Constructor = ConvenienceConstructor.componentConstructor;
    validateTypeDef(Constructor, propTypes, ReactPropTypeLocations.prop);
    Constructor.propTypes = merge(Constructor.propTypes, propTypes);
  },
  statics: function(ConvenienceConstructor, statics) {
    mixStaticSpecIntoComponent(ConvenienceConstructor, statics);
  }
};
function validateTypeDef(Constructor, typeDef, location) {
  for (var propName in typeDef) {
    if (typeDef.hasOwnProperty(propName)) {
      ("production" !== process.env.NODE_ENV ? invariant(typeof typeDef[propName] == 'function', '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', Constructor.displayName || 'ReactCompositeComponent', ReactPropTypeLocationNames[location], propName) : invariant(typeof typeDef[propName] == 'function'));
    }
  }
}
function validateMethodOverride(proto, name) {
  var specPolicy = ReactCompositeComponentInterface[name];
  if (ReactCompositeComponentMixin.hasOwnProperty(name)) {
    ("production" !== process.env.NODE_ENV ? invariant(specPolicy === SpecPolicy.OVERRIDE_BASE, 'ReactCompositeComponentInterface: You are attempting to override ' + '`%s` from your class specification. Ensure that your method names ' + 'do not overlap with React methods.', name) : invariant(specPolicy === SpecPolicy.OVERRIDE_BASE));
  }
  if (proto.hasOwnProperty(name)) {
    ("production" !== process.env.NODE_ENV ? invariant(specPolicy === SpecPolicy.DEFINE_MANY || specPolicy === SpecPolicy.DEFINE_MANY_MERGED, 'ReactCompositeComponentInterface: You are attempting to define ' + '`%s` on your component more than once. This conflict may be due ' + 'to a mixin.', name) : invariant(specPolicy === SpecPolicy.DEFINE_MANY || specPolicy === SpecPolicy.DEFINE_MANY_MERGED));
  }
}
function validateLifeCycleOnReplaceState(instance) {
  var compositeLifeCycleState = instance._compositeLifeCycleState;
  ("production" !== process.env.NODE_ENV ? invariant(instance.isMounted() || compositeLifeCycleState === CompositeLifeCycle.MOUNTING, 'replaceState(...): Can only update a mounted or mounting component.') : invariant(instance.isMounted() || compositeLifeCycleState === CompositeLifeCycle.MOUNTING));
  ("production" !== process.env.NODE_ENV ? invariant(compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE, 'replaceState(...): Cannot update during an existing state transition ' + '(such as within `render`). This could potentially cause an infinite ' + 'loop so it is forbidden.') : invariant(compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE));
  ("production" !== process.env.NODE_ENV ? invariant(compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING, 'replaceState(...): Cannot update while unmounting component. This ' + 'usually means you called setState() on an unmounted component.') : invariant(compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING));
}
function mixSpecIntoComponent(ConvenienceConstructor, spec) {
  ("production" !== process.env.NODE_ENV ? invariant(!isValidClass(spec), 'ReactCompositeComponent: You\'re attempting to ' + 'use a component class as a mixin. Instead, just use a regular object.') : invariant(!isValidClass(spec)));
  ("production" !== process.env.NODE_ENV ? invariant(!ReactComponent.isValidComponent(spec), 'ReactCompositeComponent: You\'re attempting to ' + 'use a component as a mixin. Instead, just use a regular object.') : invariant(!ReactComponent.isValidComponent(spec)));
  var Constructor = ConvenienceConstructor.componentConstructor;
  var proto = Constructor.prototype;
  for (var name in spec) {
    var property = spec[name];
    if (!spec.hasOwnProperty(name)) {
      continue;
    }
    validateMethodOverride(proto, name);
    if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
      RESERVED_SPEC_KEYS[name](ConvenienceConstructor, property);
    } else {
      var isCompositeComponentMethod = name in ReactCompositeComponentInterface;
      var isInherited = name in proto;
      var markedDontBind = property && property.__reactDontBind;
      var isFunction = typeof property === 'function';
      var shouldAutoBind = isFunction && !isCompositeComponentMethod && !isInherited && !markedDontBind;
      if (shouldAutoBind) {
        if (!proto.__reactAutoBindMap) {
          proto.__reactAutoBindMap = {};
        }
        proto.__reactAutoBindMap[name] = property;
        proto[name] = property;
      } else {
        if (isInherited) {
          if (ReactCompositeComponentInterface[name] === SpecPolicy.DEFINE_MANY_MERGED) {
            proto[name] = createMergedResultFunction(proto[name], property);
          } else {
            proto[name] = createChainedFunction(proto[name], property);
          }
        } else {
          proto[name] = property;
        }
      }
    }
  }
}
function mixStaticSpecIntoComponent(ConvenienceConstructor, statics) {
  if (!statics) {
    return;
  }
  for (var name in statics) {
    var property = statics[name];
    if (!statics.hasOwnProperty(name) || !property) {
      return;
    }
    var isInherited = name in ConvenienceConstructor;
    var result = property;
    if (isInherited) {
      var existingProperty = ConvenienceConstructor[name];
      var existingType = typeof existingProperty;
      var propertyType = typeof property;
      ("production" !== process.env.NODE_ENV ? invariant(existingType === 'function' && propertyType === 'function', 'ReactCompositeComponent: You are attempting to define ' + '`%s` on your component more than once, but that is only supported ' + 'for functions, which are chained together. This conflict may be ' + 'due to a mixin.', name) : invariant(existingType === 'function' && propertyType === 'function'));
      result = createChainedFunction(existingProperty, property);
    }
    ConvenienceConstructor[name] = result;
    ConvenienceConstructor.componentConstructor[name] = result;
  }
}
function mergeObjectsWithNoDuplicateKeys(one, two) {
  ("production" !== process.env.NODE_ENV ? invariant(one && two && typeof one === 'object' && typeof two === 'object', 'mergeObjectsWithNoDuplicateKeys(): Cannot merge non-objects') : invariant(one && two && typeof one === 'object' && typeof two === 'object'));
  objMap(two, function(value, key) {
    ("production" !== process.env.NODE_ENV ? invariant(one[key] === undefined, 'mergeObjectsWithNoDuplicateKeys(): ' + 'Tried to merge two objects with the same key: %s', key) : invariant(one[key] === undefined));
    one[key] = value;
  });
  return one;
}
function createMergedResultFunction(one, two) {
  return function mergedResult() {
    var a = one.apply(this, arguments);
    var b = two.apply(this, arguments);
    if (a == null) {
      return b;
    } else if (b == null) {
      return a;
    }
    return mergeObjectsWithNoDuplicateKeys(a, b);
  };
}
function createChainedFunction(one, two) {
  return function chainedFunction() {
    one.apply(this, arguments);
    two.apply(this, arguments);
  };
}
if ("production" !== process.env.NODE_ENV) {
  var unmountedPropertyWhitelist = {
    constructor: true,
    construct: true,
    isOwnedBy: true,
    mountComponent: true,
    mountComponentIntoNode: true,
    props: true,
    type: true,
    _checkPropTypes: true,
    _mountComponentIntoNode: true,
    _processContext: true
  };
  var hasWarnedOnComponentType = {};
  var warnIfUnmounted = function(instance, key) {
    if (instance.__hasBeenMounted) {
      return;
    }
    var name = instance.constructor.displayName || 'Unknown';
    var owner = ReactCurrentOwner.current;
    var ownerName = (owner && owner.constructor.displayName) || 'Unknown';
    var warningKey = key + '|' + name + '|' + ownerName;
    if (hasWarnedOnComponentType.hasOwnProperty(warningKey)) {
      return;
    }
    hasWarnedOnComponentType[warningKey] = true;
    var context = owner ? ' in ' + ownerName + '.' : ' at the top level.';
    var staticMethodExample = '<' + name + ' />.type.' + key + '(...)';
    console.warn('Invalid access to component property "' + key + '" on ' + name + context + ' See http://fb.me/react-warning-descriptors .' + ' Use a static method instead: ' + staticMethodExample);
  };
  var defineMembraneProperty = function(membrane, prototype, key) {
    Object.defineProperty(membrane, key, {
      configurable: false,
      enumerable: true,
      get: function() {
        if (this !== membrane) {
          warnIfUnmounted(this, key);
        }
        return prototype[key];
      },
      set: function(value) {
        if (this !== membrane) {
          warnIfUnmounted(this, key);
          Object.defineProperty(this, key, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: value
          });
        } else {
          prototype[key] = value;
        }
      }
    });
  };
  var createMountWarningMembrane = function(prototype) {
    try {
      var membrane = Object.create(prototype);
      for (var key in prototype) {
        if (unmountedPropertyWhitelist.hasOwnProperty(key)) {
          continue;
        }
        defineMembraneProperty(membrane, prototype, key);
      }
      membrane.mountComponent = function() {
        this.__hasBeenMounted = true;
        return prototype.mountComponent.apply(this, arguments);
      };
      return membrane;
    } catch (x) {
      return prototype;
    }
  };
}
var CompositeLifeCycle = keyMirror({
  MOUNTING: null,
  UNMOUNTING: null,
  RECEIVING_PROPS: null,
  RECEIVING_STATE: null
});
var ReactCompositeComponentMixin = {
  construct: function(initialProps, children) {
    ReactComponent.Mixin.construct.apply(this, arguments);
    this.state = null;
    this._pendingState = null;
    this.context = this._processContext(ReactContext.current);
    this._currentContext = ReactContext.current;
    this._pendingContext = null;
    this._compositeLifeCycleState = null;
  },
  isMounted: function() {
    return ReactComponent.Mixin.isMounted.call(this) && this._compositeLifeCycleState !== CompositeLifeCycle.MOUNTING;
  },
  mountComponent: ReactPerf.measure('ReactCompositeComponent', 'mountComponent', function(rootID, transaction, mountDepth) {
    ReactComponent.Mixin.mountComponent.call(this, rootID, transaction, mountDepth);
    this._compositeLifeCycleState = CompositeLifeCycle.MOUNTING;
    this._defaultProps = this.getDefaultProps ? this.getDefaultProps() : null;
    this.props = this._processProps(this.props);
    if (this.__reactAutoBindMap) {
      this._bindAutoBindMethods();
    }
    this.state = this.getInitialState ? this.getInitialState() : null;
    ("production" !== process.env.NODE_ENV ? invariant(typeof this.state === 'object' && !Array.isArray(this.state), '%s.getInitialState(): must return an object or null', this.constructor.displayName || 'ReactCompositeComponent') : invariant(typeof this.state === 'object' && !Array.isArray(this.state)));
    this._pendingState = null;
    this._pendingForceUpdate = false;
    if (this.componentWillMount) {
      this.componentWillMount();
      if (this._pendingState) {
        this.state = this._pendingState;
        this._pendingState = null;
      }
    }
    this._renderedComponent = this._renderValidatedComponent();
    this._compositeLifeCycleState = null;
    var markup = this._renderedComponent.mountComponent(rootID, transaction, mountDepth + 1);
    if (this.componentDidMount) {
      transaction.getReactMountReady().enqueue(this, this.componentDidMount);
    }
    return markup;
  }),
  unmountComponent: function() {
    this._compositeLifeCycleState = CompositeLifeCycle.UNMOUNTING;
    if (this.componentWillUnmount) {
      this.componentWillUnmount();
    }
    this._compositeLifeCycleState = null;
    this._defaultProps = null;
    this._renderedComponent.unmountComponent();
    this._renderedComponent = null;
    ReactComponent.Mixin.unmountComponent.call(this);
    if (this.refs) {
      this.refs = null;
    }
  },
  setState: function(partialState, callback) {
    ("production" !== process.env.NODE_ENV ? invariant(typeof partialState === 'object' || partialState == null, 'setState(...): takes an object of state variables to update.') : invariant(typeof partialState === 'object' || partialState == null));
    if ("production" !== process.env.NODE_ENV) {
      if (partialState == null) {
        console.warn('setState(...): You passed an undefined or null state object; ' + 'instead, use forceUpdate().');
      }
    }
    this.replaceState(merge(this._pendingState || this.state, partialState), callback);
  },
  replaceState: function(completeState, callback) {
    validateLifeCycleOnReplaceState(this);
    this._pendingState = completeState;
    ReactUpdates.enqueueUpdate(this, callback);
  },
  _processContext: function(context) {
    var maskedContext = null;
    var contextTypes = this.constructor.contextTypes;
    if (contextTypes) {
      maskedContext = {};
      for (var contextName in contextTypes) {
        maskedContext[contextName] = context[contextName];
      }
      if ("production" !== process.env.NODE_ENV) {
        this._checkPropTypes(contextTypes, maskedContext, ReactPropTypeLocations.context);
      }
    }
    return maskedContext;
  },
  _processChildContext: function(currentContext) {
    var childContext = this.getChildContext && this.getChildContext();
    var displayName = this.constructor.displayName || 'ReactCompositeComponent';
    if (childContext) {
      ("production" !== process.env.NODE_ENV ? invariant(typeof this.constructor.childContextTypes === 'object', '%s.getChildContext(): childContextTypes must be defined in order to ' + 'use getChildContext().', displayName) : invariant(typeof this.constructor.childContextTypes === 'object'));
      if ("production" !== process.env.NODE_ENV) {
        this._checkPropTypes(this.constructor.childContextTypes, childContext, ReactPropTypeLocations.childContext);
      }
      for (var name in childContext) {
        ("production" !== process.env.NODE_ENV ? invariant(name in this.constructor.childContextTypes, '%s.getChildContext(): key "%s" is not defined in childContextTypes.', displayName, name) : invariant(name in this.constructor.childContextTypes));
      }
      return merge(currentContext, childContext);
    }
    return currentContext;
  },
  _processProps: function(newProps) {
    var props = merge(newProps);
    var defaultProps = this._defaultProps;
    for (var propName in defaultProps) {
      if (typeof props[propName] === 'undefined') {
        props[propName] = defaultProps[propName];
      }
    }
    if ("production" !== process.env.NODE_ENV) {
      var propTypes = this.constructor.propTypes;
      if (propTypes) {
        this._checkPropTypes(propTypes, props, ReactPropTypeLocations.prop);
      }
    }
    return props;
  },
  _checkPropTypes: function(propTypes, props, location) {
    var componentName = this.constructor.displayName;
    for (var propName in propTypes) {
      if (propTypes.hasOwnProperty(propName)) {
        propTypes[propName](props, propName, componentName, location);
      }
    }
  },
  performUpdateIfNecessary: function() {
    var compositeLifeCycleState = this._compositeLifeCycleState;
    if (compositeLifeCycleState === CompositeLifeCycle.MOUNTING || compositeLifeCycleState === CompositeLifeCycle.RECEIVING_PROPS) {
      return;
    }
    ReactComponent.Mixin.performUpdateIfNecessary.call(this);
  },
  _performUpdateIfNecessary: function(transaction) {
    if (this._pendingProps == null && this._pendingState == null && this._pendingContext == null && !this._pendingForceUpdate) {
      return;
    }
    var nextFullContext = this._pendingContext || this._currentContext;
    var nextContext = this._processContext(nextFullContext);
    this._pendingContext = null;
    var nextProps = this.props;
    if (this._pendingProps != null) {
      nextProps = this._processProps(this._pendingProps);
      this._pendingProps = null;
      this._compositeLifeCycleState = CompositeLifeCycle.RECEIVING_PROPS;
      if (this.componentWillReceiveProps) {
        this.componentWillReceiveProps(nextProps, nextContext);
      }
    }
    this._compositeLifeCycleState = CompositeLifeCycle.RECEIVING_STATE;
    var nextOwner = this._pendingOwner;
    var nextState = this._pendingState || this.state;
    this._pendingState = null;
    try {
      if (this._pendingForceUpdate || !this.shouldComponentUpdate || this.shouldComponentUpdate(nextProps, nextState, nextContext)) {
        this._pendingForceUpdate = false;
        this._performComponentUpdate(nextProps, nextOwner, nextState, nextFullContext, nextContext, transaction);
      } else {
        this.props = nextProps;
        this._owner = nextOwner;
        this.state = nextState;
        this._currentContext = nextFullContext;
        this.context = nextContext;
      }
    } finally {
      this._compositeLifeCycleState = null;
    }
  },
  _performComponentUpdate: function(nextProps, nextOwner, nextState, nextFullContext, nextContext, transaction) {
    var prevProps = this.props;
    var prevOwner = this._owner;
    var prevState = this.state;
    var prevContext = this.context;
    if (this.componentWillUpdate) {
      this.componentWillUpdate(nextProps, nextState, nextContext);
    }
    this.props = nextProps;
    this._owner = nextOwner;
    this.state = nextState;
    this._currentContext = nextFullContext;
    this.context = nextContext;
    this.updateComponent(transaction, prevProps, prevOwner, prevState, prevContext);
    if (this.componentDidUpdate) {
      transaction.getReactMountReady().enqueue(this, this.componentDidUpdate.bind(this, prevProps, prevState, prevContext));
    }
  },
  receiveComponent: function(nextComponent, transaction) {
    if (nextComponent === this) {
      return;
    }
    this._pendingContext = nextComponent._currentContext;
    ReactComponent.Mixin.receiveComponent.call(this, nextComponent, transaction);
  },
  updateComponent: ReactPerf.measure('ReactCompositeComponent', 'updateComponent', function(transaction, prevProps, prevOwner, prevState, prevContext) {
    ReactComponent.Mixin.updateComponent.call(this, transaction, prevProps, prevOwner);
    var prevComponent = this._renderedComponent;
    var nextComponent = this._renderValidatedComponent();
    if (shouldUpdateReactComponent(prevComponent, nextComponent)) {
      prevComponent.receiveComponent(nextComponent, transaction);
    } else {
      var thisID = this._rootNodeID;
      var prevComponentID = prevComponent._rootNodeID;
      prevComponent.unmountComponent();
      this._renderedComponent = nextComponent;
      var nextMarkup = nextComponent.mountComponent(thisID, transaction, this._mountDepth + 1);
      ReactComponent.BackendIDOperations.dangerouslyReplaceNodeWithMarkupByID(prevComponentID, nextMarkup);
    }
  }),
  forceUpdate: function(callback) {
    var compositeLifeCycleState = this._compositeLifeCycleState;
    ("production" !== process.env.NODE_ENV ? invariant(this.isMounted() || compositeLifeCycleState === CompositeLifeCycle.MOUNTING, 'forceUpdate(...): Can only force an update on mounted or mounting ' + 'components.') : invariant(this.isMounted() || compositeLifeCycleState === CompositeLifeCycle.MOUNTING));
    ("production" !== process.env.NODE_ENV ? invariant(compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE && compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING, 'forceUpdate(...): Cannot force an update while unmounting component ' + 'or during an existing state transition (such as within `render`).') : invariant(compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE && compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING));
    this._pendingForceUpdate = true;
    ReactUpdates.enqueueUpdate(this, callback);
  },
  _renderValidatedComponent: ReactPerf.measure('ReactCompositeComponent', '_renderValidatedComponent', function() {
    var renderedComponent;
    var previousContext = ReactContext.current;
    ReactContext.current = this._processChildContext(this._currentContext);
    ReactCurrentOwner.current = this;
    try {
      renderedComponent = this.render();
    } finally {
      ReactContext.current = previousContext;
      ReactCurrentOwner.current = null;
    }
    ("production" !== process.env.NODE_ENV ? invariant(ReactComponent.isValidComponent(renderedComponent), '%s.render(): A valid ReactComponent must be returned. You may have ' + 'returned null, undefined, an array, or some other invalid object.', this.constructor.displayName || 'ReactCompositeComponent') : invariant(ReactComponent.isValidComponent(renderedComponent)));
    return renderedComponent;
  }),
  _bindAutoBindMethods: function() {
    for (var autoBindKey in this.__reactAutoBindMap) {
      if (!this.__reactAutoBindMap.hasOwnProperty(autoBindKey)) {
        continue;
      }
      var method = this.__reactAutoBindMap[autoBindKey];
      this[autoBindKey] = this._bindAutoBindMethod(ReactErrorUtils.guard(method, this.constructor.displayName + '.' + autoBindKey));
    }
  },
  _bindAutoBindMethod: function(method) {
    var component = this;
    var boundMethod = function() {
      return method.apply(component, arguments);
    };
    if ("production" !== process.env.NODE_ENV) {
      boundMethod.__reactBoundContext = component;
      boundMethod.__reactBoundMethod = method;
      boundMethod.__reactBoundArguments = null;
      var componentName = component.constructor.displayName;
      var _bind = boundMethod.bind;
      boundMethod.bind = function(newThis) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (newThis !== component && newThis !== null) {
          console.warn('bind(): React component methods may only be bound to the ' + 'component instance. See ' + componentName);
        } else if (!args.length) {
          console.warn('bind(): You are binding a component method to the component. ' + 'React does this for you automatically in a high-performance ' + 'way, so you can safely remove this call. See ' + componentName);
          return boundMethod;
        }
        var reboundMethod = _bind.apply(boundMethod, arguments);
        reboundMethod.__reactBoundContext = component;
        reboundMethod.__reactBoundMethod = method;
        reboundMethod.__reactBoundArguments = args;
        return reboundMethod;
      };
    }
    return boundMethod;
  }
};
var ReactCompositeComponentBase = function() {};
mixInto(ReactCompositeComponentBase, ReactComponent.Mixin);
mixInto(ReactCompositeComponentBase, ReactOwner.Mixin);
mixInto(ReactCompositeComponentBase, ReactPropTransferer.Mixin);
mixInto(ReactCompositeComponentBase, ReactCompositeComponentMixin);
function isValidClass(componentClass) {
  return componentClass instanceof Function && 'componentConstructor' in componentClass && componentClass.componentConstructor instanceof Function;
}
var ReactCompositeComponent = {
  LifeCycle: CompositeLifeCycle,
  Base: ReactCompositeComponentBase,
  createClass: function(spec) {
    var Constructor = function() {};
    Constructor.prototype = new ReactCompositeComponentBase();
    Constructor.prototype.constructor = Constructor;
    var ConvenienceConstructor = function(props, children) {
      var instance = new Constructor();
      instance.construct.apply(instance, arguments);
      return instance;
    };
    ConvenienceConstructor.componentConstructor = Constructor;
    Constructor.ConvenienceConstructor = ConvenienceConstructor;
    ConvenienceConstructor.originalSpec = spec;
    mixSpecIntoComponent(ConvenienceConstructor, spec);
    ("production" !== process.env.NODE_ENV ? invariant(Constructor.prototype.render, 'createClass(...): Class specification must implement a `render` method.') : invariant(Constructor.prototype.render));
    if ("production" !== process.env.NODE_ENV) {
      if (Constructor.prototype.componentShouldUpdate) {
        console.warn((spec.displayName || 'A component') + ' has a method called ' + 'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' + 'The name is phrased as a question because the function is ' + 'expected to return a value.');
      }
    }
    ConvenienceConstructor.type = Constructor;
    Constructor.prototype.type = Constructor;
    for (var methodName in ReactCompositeComponentInterface) {
      if (!Constructor.prototype[methodName]) {
        Constructor.prototype[methodName] = null;
      }
    }
    if ("production" !== process.env.NODE_ENV) {
      Constructor.prototype = createMountWarningMembrane(Constructor.prototype);
    }
    return ConvenienceConstructor;
  },
  isValidClass: isValidClass
};
module.exports = ReactCompositeComponent;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactComponent":40,"./ReactContext":44,"./ReactCurrentOwner":45,"./ReactErrorUtils":61,"./ReactOwner":73,"./ReactPerf":74,"./ReactPropTransferer":75,"./ReactPropTypeLocationNames":76,"./ReactPropTypeLocations":77,"./ReactUpdates":84,"./invariant":122,"./keyMirror":128,"./merge":131,"./mixInto":134,"./objMap":135,"./shouldUpdateReactComponent":140,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],44:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactContext";
"use strict";
var merge = require("./merge");
var ReactContext = {
  current: {},
  withContext: function(newContext, scopedCallback) {
    var result;
    var previousContext = ReactContext.current;
    ReactContext.current = merge(previousContext, newContext);
    try {
      result = scopedCallback();
    } finally {
      ReactContext.current = previousContext;
    }
    return result;
  }
};
module.exports = ReactContext;


},{"./merge":131}],45:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactCurrentOwner";
"use strict";
var ReactCurrentOwner = {current: null};
module.exports = ReactCurrentOwner;


},{}],46:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOM";
"use strict";
var ReactDOMComponent = require("./ReactDOMComponent");
var mergeInto = require("./mergeInto");
var objMapKeyVal = require("./objMapKeyVal");
function createDOMComponentClass(tag, omitClose) {
  var Constructor = function() {};
  Constructor.prototype = new ReactDOMComponent(tag, omitClose);
  Constructor.prototype.constructor = Constructor;
  Constructor.displayName = tag;
  var ConvenienceConstructor = function(props, children) {
    var instance = new Constructor();
    instance.construct.apply(instance, arguments);
    return instance;
  };
  ConvenienceConstructor.type = Constructor;
  Constructor.prototype.type = Constructor;
  Constructor.ConvenienceConstructor = ConvenienceConstructor;
  ConvenienceConstructor.componentConstructor = Constructor;
  return ConvenienceConstructor;
}
var ReactDOM = objMapKeyVal({
  a: false,
  abbr: false,
  address: false,
  area: false,
  article: false,
  aside: false,
  audio: false,
  b: false,
  base: false,
  bdi: false,
  bdo: false,
  big: false,
  blockquote: false,
  body: false,
  br: true,
  button: false,
  canvas: false,
  caption: false,
  cite: false,
  code: false,
  col: true,
  colgroup: false,
  data: false,
  datalist: false,
  dd: false,
  del: false,
  details: false,
  dfn: false,
  div: false,
  dl: false,
  dt: false,
  em: false,
  embed: true,
  fieldset: false,
  figcaption: false,
  figure: false,
  footer: false,
  form: false,
  h1: false,
  h2: false,
  h3: false,
  h4: false,
  h5: false,
  h6: false,
  head: false,
  header: false,
  hr: true,
  html: false,
  i: false,
  iframe: false,
  img: true,
  input: true,
  ins: false,
  kbd: false,
  keygen: true,
  label: false,
  legend: false,
  li: false,
  link: false,
  main: false,
  map: false,
  mark: false,
  menu: false,
  menuitem: false,
  meta: true,
  meter: false,
  nav: false,
  noscript: false,
  object: false,
  ol: false,
  optgroup: false,
  option: false,
  output: false,
  p: false,
  param: true,
  pre: false,
  progress: false,
  q: false,
  rp: false,
  rt: false,
  ruby: false,
  s: false,
  samp: false,
  script: false,
  section: false,
  select: false,
  small: false,
  source: false,
  span: false,
  strong: false,
  style: false,
  sub: false,
  summary: false,
  sup: false,
  table: false,
  tbody: false,
  td: false,
  textarea: false,
  tfoot: false,
  th: false,
  thead: false,
  time: false,
  title: false,
  tr: false,
  track: true,
  u: false,
  ul: false,
  'var': false,
  video: false,
  wbr: false,
  circle: false,
  defs: false,
  g: false,
  line: false,
  linearGradient: false,
  path: false,
  polygon: false,
  polyline: false,
  radialGradient: false,
  rect: false,
  stop: false,
  svg: false,
  text: false
}, createDOMComponentClass);
var injection = {injectComponentClasses: function(componentClasses) {
    mergeInto(ReactDOM, componentClasses);
  }};
ReactDOM.injection = injection;
module.exports = ReactDOM;


},{"./ReactDOMComponent":48,"./mergeInto":133,"./objMapKeyVal":136}],47:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMButton";
"use strict";
var AutoFocusMixin = require("./AutoFocusMixin");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var keyMirror = require("./keyMirror");
var button = ReactDOM.button;
var mouseListenerNames = keyMirror({
  onClick: true,
  onDoubleClick: true,
  onMouseDown: true,
  onMouseMove: true,
  onMouseUp: true,
  onClickCapture: true,
  onDoubleClickCapture: true,
  onMouseDownCapture: true,
  onMouseMoveCapture: true,
  onMouseUpCapture: true
});
var ReactDOMButton = ReactCompositeComponent.createClass({
  displayName: 'ReactDOMButton',
  mixins: [AutoFocusMixin],
  render: function() {
    var props = {};
    for (var key in this.props) {
      if (this.props.hasOwnProperty(key) && (!this.props.disabled || !mouseListenerNames[key])) {
        props[key] = this.props[key];
      }
    }
    return button(props, this.props.children);
  }
});
module.exports = ReactDOMButton;


},{"./AutoFocusMixin":15,"./ReactCompositeComponent":43,"./ReactDOM":46,"./keyMirror":128}],48:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMComponent";
"use strict";
var CSSPropertyOperations = require("./CSSPropertyOperations");
var DOMProperty = require("./DOMProperty");
var DOMPropertyOperations = require("./DOMPropertyOperations");
var ReactComponent = require("./ReactComponent");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactMount = require("./ReactMount");
var ReactMultiChild = require("./ReactMultiChild");
var ReactPerf = require("./ReactPerf");
var escapeTextForBrowser = require("./escapeTextForBrowser");
var invariant = require("./invariant");
var keyOf = require("./keyOf");
var merge = require("./merge");
var mixInto = require("./mixInto");
var deleteListener = ReactEventEmitter.deleteListener;
var listenTo = ReactEventEmitter.listenTo;
var registrationNameModules = ReactEventEmitter.registrationNameModules;
var CONTENT_TYPES = {
  'string': true,
  'number': true
};
var STYLE = keyOf({style: null});
var ELEMENT_NODE_TYPE = 1;
function assertValidProps(props) {
  if (!props) {
    return;
  }
  ("production" !== process.env.NODE_ENV ? invariant(props.children == null || props.dangerouslySetInnerHTML == null, 'Can only set one of `children` or `props.dangerouslySetInnerHTML`.') : invariant(props.children == null || props.dangerouslySetInnerHTML == null));
  ("production" !== process.env.NODE_ENV ? invariant(props.style == null || typeof props.style === 'object', 'The `style` prop expects a mapping from style properties to values, ' + 'not a string.') : invariant(props.style == null || typeof props.style === 'object'));
}
function putListener(id, registrationName, listener, transaction) {
  var container = ReactMount.findReactContainerForID(id);
  if (container) {
    var doc = container.nodeType === ELEMENT_NODE_TYPE ? container.ownerDocument : container;
    listenTo(registrationName, doc);
  }
  transaction.getPutListenerQueue().enqueuePutListener(id, registrationName, listener);
}
function ReactDOMComponent(tag, omitClose) {
  this._tagOpen = '<' + tag;
  this._tagClose = omitClose ? '' : '</' + tag + '>';
  this.tagName = tag.toUpperCase();
}
ReactDOMComponent.Mixin = {
  mountComponent: ReactPerf.measure('ReactDOMComponent', 'mountComponent', function(rootID, transaction, mountDepth) {
    ReactComponent.Mixin.mountComponent.call(this, rootID, transaction, mountDepth);
    assertValidProps(this.props);
    return (this._createOpenTagMarkupAndPutListeners(transaction) + this._createContentMarkup(transaction) + this._tagClose);
  }),
  _createOpenTagMarkupAndPutListeners: function(transaction) {
    var props = this.props;
    var ret = this._tagOpen;
    for (var propKey in props) {
      if (!props.hasOwnProperty(propKey)) {
        continue;
      }
      var propValue = props[propKey];
      if (propValue == null) {
        continue;
      }
      if (registrationNameModules[propKey]) {
        putListener(this._rootNodeID, propKey, propValue, transaction);
      } else {
        if (propKey === STYLE) {
          if (propValue) {
            propValue = props.style = merge(props.style);
          }
          propValue = CSSPropertyOperations.createMarkupForStyles(propValue);
        }
        var markup = DOMPropertyOperations.createMarkupForProperty(propKey, propValue);
        if (markup) {
          ret += ' ' + markup;
        }
      }
    }
    var idMarkup = DOMPropertyOperations.createMarkupForID(this._rootNodeID);
    return ret + ' ' + idMarkup + '>';
  },
  _createContentMarkup: function(transaction) {
    var innerHTML = this.props.dangerouslySetInnerHTML;
    if (innerHTML != null) {
      if (innerHTML.__html != null) {
        return innerHTML.__html;
      }
    } else {
      var contentToUse = CONTENT_TYPES[typeof this.props.children] ? this.props.children : null;
      var childrenToUse = contentToUse != null ? null : this.props.children;
      if (contentToUse != null) {
        return escapeTextForBrowser(contentToUse);
      } else if (childrenToUse != null) {
        var mountImages = this.mountChildren(childrenToUse, transaction);
        return mountImages.join('');
      }
    }
    return '';
  },
  receiveComponent: function(nextComponent, transaction) {
    assertValidProps(nextComponent.props);
    ReactComponent.Mixin.receiveComponent.call(this, nextComponent, transaction);
  },
  updateComponent: ReactPerf.measure('ReactDOMComponent', 'updateComponent', function(transaction, prevProps, prevOwner) {
    ReactComponent.Mixin.updateComponent.call(this, transaction, prevProps, prevOwner);
    this._updateDOMProperties(prevProps, transaction);
    this._updateDOMChildren(prevProps, transaction);
  }),
  _updateDOMProperties: function(lastProps, transaction) {
    var nextProps = this.props;
    var propKey;
    var styleName;
    var styleUpdates;
    for (propKey in lastProps) {
      if (nextProps.hasOwnProperty(propKey) || !lastProps.hasOwnProperty(propKey)) {
        continue;
      }
      if (propKey === STYLE) {
        var lastStyle = lastProps[propKey];
        for (styleName in lastStyle) {
          if (lastStyle.hasOwnProperty(styleName)) {
            styleUpdates = styleUpdates || {};
            styleUpdates[styleName] = '';
          }
        }
      } else if (registrationNameModules[propKey]) {
        deleteListener(this._rootNodeID, propKey);
      } else if (DOMProperty.isStandardName[propKey] || DOMProperty.isCustomAttribute(propKey)) {
        ReactComponent.BackendIDOperations.deletePropertyByID(this._rootNodeID, propKey);
      }
    }
    for (propKey in nextProps) {
      var nextProp = nextProps[propKey];
      var lastProp = lastProps[propKey];
      if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp) {
        continue;
      }
      if (propKey === STYLE) {
        if (nextProp) {
          nextProp = nextProps.style = merge(nextProp);
        }
        if (lastProp) {
          for (styleName in lastProp) {
            if (lastProp.hasOwnProperty(styleName) && !nextProp.hasOwnProperty(styleName)) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = '';
            }
          }
          for (styleName in nextProp) {
            if (nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName]) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = nextProp[styleName];
            }
          }
        } else {
          styleUpdates = nextProp;
        }
      } else if (registrationNameModules[propKey]) {
        putListener(this._rootNodeID, propKey, nextProp, transaction);
      } else if (DOMProperty.isStandardName[propKey] || DOMProperty.isCustomAttribute(propKey)) {
        ReactComponent.BackendIDOperations.updatePropertyByID(this._rootNodeID, propKey, nextProp);
      }
    }
    if (styleUpdates) {
      ReactComponent.BackendIDOperations.updateStylesByID(this._rootNodeID, styleUpdates);
    }
  },
  _updateDOMChildren: function(lastProps, transaction) {
    var nextProps = this.props;
    var lastContent = CONTENT_TYPES[typeof lastProps.children] ? lastProps.children : null;
    var nextContent = CONTENT_TYPES[typeof nextProps.children] ? nextProps.children : null;
    var lastHtml = lastProps.dangerouslySetInnerHTML && lastProps.dangerouslySetInnerHTML.__html;
    var nextHtml = nextProps.dangerouslySetInnerHTML && nextProps.dangerouslySetInnerHTML.__html;
    var lastChildren = lastContent != null ? null : lastProps.children;
    var nextChildren = nextContent != null ? null : nextProps.children;
    var lastHasContentOrHtml = lastContent != null || lastHtml != null;
    var nextHasContentOrHtml = nextContent != null || nextHtml != null;
    if (lastChildren != null && nextChildren == null) {
      this.updateChildren(null, transaction);
    } else if (lastHasContentOrHtml && !nextHasContentOrHtml) {
      this.updateTextContent('');
    }
    if (nextContent != null) {
      if (lastContent !== nextContent) {
        this.updateTextContent('' + nextContent);
      }
    } else if (nextHtml != null) {
      if (lastHtml !== nextHtml) {
        ReactComponent.BackendIDOperations.updateInnerHTMLByID(this._rootNodeID, nextHtml);
      }
    } else if (nextChildren != null) {
      this.updateChildren(nextChildren, transaction);
    }
  },
  unmountComponent: function() {
    this.unmountChildren();
    ReactEventEmitter.deleteAllListeners(this._rootNodeID);
    ReactComponent.Mixin.unmountComponent.call(this);
  }
};
mixInto(ReactDOMComponent, ReactComponent.Mixin);
mixInto(ReactDOMComponent, ReactDOMComponent.Mixin);
mixInto(ReactDOMComponent, ReactMultiChild.Mixin);
module.exports = ReactDOMComponent;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./CSSPropertyOperations":17,"./DOMProperty":22,"./DOMPropertyOperations":23,"./ReactComponent":40,"./ReactEventEmitter":62,"./ReactMount":69,"./ReactMultiChild":71,"./ReactPerf":74,"./escapeTextForBrowser":110,"./invariant":122,"./keyOf":129,"./merge":131,"./mixInto":134,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],49:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMForm";
"use strict";
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var ReactEventEmitter = require("./ReactEventEmitter");
var EventConstants = require("./EventConstants");
var form = ReactDOM.form;
var ReactDOMForm = ReactCompositeComponent.createClass({
  displayName: 'ReactDOMForm',
  render: function() {
    return this.transferPropsTo(form(null, this.props.children));
  },
  componentDidMount: function() {
    ReactEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topReset, 'reset', this.getDOMNode());
    ReactEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topSubmit, 'submit', this.getDOMNode());
  }
});
module.exports = ReactDOMForm;


},{"./EventConstants":28,"./ReactCompositeComponent":43,"./ReactDOM":46,"./ReactEventEmitter":62}],50:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMIDOperations";
"use strict";
var CSSPropertyOperations = require("./CSSPropertyOperations");
var DOMChildrenOperations = require("./DOMChildrenOperations");
var DOMPropertyOperations = require("./DOMPropertyOperations");
var ReactMount = require("./ReactMount");
var ReactPerf = require("./ReactPerf");
var invariant = require("./invariant");
var INVALID_PROPERTY_ERRORS = {
  dangerouslySetInnerHTML: '`dangerouslySetInnerHTML` must be set using `updateInnerHTMLByID()`.',
  style: '`style` must be set using `updateStylesByID()`.'
};
var useWhitespaceWorkaround;
var ReactDOMIDOperations = {
  updatePropertyByID: ReactPerf.measure('ReactDOMIDOperations', 'updatePropertyByID', function(id, name, value) {
    var node = ReactMount.getNode(id);
    ("production" !== process.env.NODE_ENV ? invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name), 'updatePropertyByID(...): %s', INVALID_PROPERTY_ERRORS[name]) : invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name)));
    if (value != null) {
      DOMPropertyOperations.setValueForProperty(node, name, value);
    } else {
      DOMPropertyOperations.deleteValueForProperty(node, name);
    }
  }),
  deletePropertyByID: ReactPerf.measure('ReactDOMIDOperations', 'deletePropertyByID', function(id, name, value) {
    var node = ReactMount.getNode(id);
    ("production" !== process.env.NODE_ENV ? invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name), 'updatePropertyByID(...): %s', INVALID_PROPERTY_ERRORS[name]) : invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name)));
    DOMPropertyOperations.deleteValueForProperty(node, name, value);
  }),
  updateStylesByID: ReactPerf.measure('ReactDOMIDOperations', 'updateStylesByID', function(id, styles) {
    var node = ReactMount.getNode(id);
    CSSPropertyOperations.setValueForStyles(node, styles);
  }),
  updateInnerHTMLByID: ReactPerf.measure('ReactDOMIDOperations', 'updateInnerHTMLByID', function(id, html) {
    var node = ReactMount.getNode(id);
    if (useWhitespaceWorkaround === undefined) {
      var temp = document.createElement('div');
      temp.innerHTML = ' ';
      useWhitespaceWorkaround = temp.innerHTML === '';
    }
    if (useWhitespaceWorkaround) {
      node.parentNode.replaceChild(node, node);
    }
    if (useWhitespaceWorkaround && html.match(/^[ \r\n\t\f]/)) {
      node.innerHTML = '\uFEFF' + html;
      node.firstChild.deleteData(0, 1);
    } else {
      node.innerHTML = html;
    }
  }),
  updateTextContentByID: ReactPerf.measure('ReactDOMIDOperations', 'updateTextContentByID', function(id, content) {
    var node = ReactMount.getNode(id);
    DOMChildrenOperations.updateTextContent(node, content);
  }),
  dangerouslyReplaceNodeWithMarkupByID: ReactPerf.measure('ReactDOMIDOperations', 'dangerouslyReplaceNodeWithMarkupByID', function(id, markup) {
    var node = ReactMount.getNode(id);
    DOMChildrenOperations.dangerouslyReplaceNodeWithMarkup(node, markup);
  }),
  dangerouslyProcessChildrenUpdates: ReactPerf.measure('ReactDOMIDOperations', 'dangerouslyProcessChildrenUpdates', function(updates, markup) {
    for (var i = 0; i < updates.length; i++) {
      updates[i].parentNode = ReactMount.getNode(updates[i].parentID);
    }
    DOMChildrenOperations.processUpdates(updates, markup);
  })
};
module.exports = ReactDOMIDOperations;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./CSSPropertyOperations":17,"./DOMChildrenOperations":21,"./DOMPropertyOperations":23,"./ReactMount":69,"./ReactPerf":74,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],51:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMImg";
"use strict";
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var ReactEventEmitter = require("./ReactEventEmitter");
var EventConstants = require("./EventConstants");
var img = ReactDOM.img;
var ReactDOMImg = ReactCompositeComponent.createClass({
  displayName: 'ReactDOMImg',
  tagName: 'IMG',
  render: function() {
    return img(this.props);
  },
  componentDidMount: function() {
    var node = this.getDOMNode();
    ReactEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topLoad, 'load', node);
    ReactEventEmitter.trapBubbledEvent(EventConstants.topLevelTypes.topError, 'error', node);
  }
});
module.exports = ReactDOMImg;


},{"./EventConstants":28,"./ReactCompositeComponent":43,"./ReactDOM":46,"./ReactEventEmitter":62}],52:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMInput";
"use strict";
var AutoFocusMixin = require("./AutoFocusMixin");
var DOMPropertyOperations = require("./DOMPropertyOperations");
var LinkedValueUtils = require("./LinkedValueUtils");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var ReactMount = require("./ReactMount");
var invariant = require("./invariant");
var merge = require("./merge");
var input = ReactDOM.input;
var instancesByReactID = {};
var ReactDOMInput = ReactCompositeComponent.createClass({
  displayName: 'ReactDOMInput',
  mixins: [AutoFocusMixin, LinkedValueUtils.Mixin],
  getInitialState: function() {
    var defaultValue = this.props.defaultValue;
    return {
      checked: this.props.defaultChecked || false,
      value: defaultValue != null ? defaultValue : null
    };
  },
  shouldComponentUpdate: function() {
    return !this._isChanging;
  },
  render: function() {
    var props = merge(this.props);
    props.defaultChecked = null;
    props.defaultValue = null;
    var value = LinkedValueUtils.getValue(this);
    props.value = value != null ? value : this.state.value;
    var checked = LinkedValueUtils.getChecked(this);
    props.checked = checked != null ? checked : this.state.checked;
    props.onChange = this._handleChange;
    return input(props, this.props.children);
  },
  componentDidMount: function() {
    var id = ReactMount.getID(this.getDOMNode());
    instancesByReactID[id] = this;
  },
  componentWillUnmount: function() {
    var rootNode = this.getDOMNode();
    var id = ReactMount.getID(rootNode);
    delete instancesByReactID[id];
  },
  componentDidUpdate: function(prevProps, prevState, prevContext) {
    var rootNode = this.getDOMNode();
    if (this.props.checked != null) {
      DOMPropertyOperations.setValueForProperty(rootNode, 'checked', this.props.checked || false);
    }
    var value = LinkedValueUtils.getValue(this);
    if (value != null) {
      DOMPropertyOperations.setValueForProperty(rootNode, 'value', '' + value);
    }
  },
  _handleChange: function(event) {
    var returnValue;
    var onChange = LinkedValueUtils.getOnChange(this);
    if (onChange) {
      this._isChanging = true;
      returnValue = onChange.call(this, event);
      this._isChanging = false;
    }
    this.setState({
      checked: event.target.checked,
      value: event.target.value
    });
    var name = this.props.name;
    if (this.props.type === 'radio' && name != null) {
      var rootNode = this.getDOMNode();
      var queryRoot = rootNode;
      while (queryRoot.parentNode) {
        queryRoot = queryRoot.parentNode;
      }
      var group = queryRoot.querySelectorAll('input[name=' + JSON.stringify('' + name) + '][type="radio"]');
      for (var i = 0,
          groupLen = group.length; i < groupLen; i++) {
        var otherNode = group[i];
        if (otherNode === rootNode || otherNode.form !== rootNode.form) {
          continue;
        }
        var otherID = ReactMount.getID(otherNode);
        ("production" !== process.env.NODE_ENV ? invariant(otherID, 'ReactDOMInput: Mixing React and non-React radio inputs with the ' + 'same `name` is not supported.') : invariant(otherID));
        var otherInstance = instancesByReactID[otherID];
        ("production" !== process.env.NODE_ENV ? invariant(otherInstance, 'ReactDOMInput: Unknown radio button ID %s.', otherID) : invariant(otherInstance));
        otherInstance.setState({checked: false});
      }
    }
    return returnValue;
  }
});
module.exports = ReactDOMInput;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./AutoFocusMixin":15,"./DOMPropertyOperations":23,"./LinkedValueUtils":35,"./ReactCompositeComponent":43,"./ReactDOM":46,"./ReactMount":69,"./invariant":122,"./merge":131,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],53:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMOption";
"use strict";
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var option = ReactDOM.option;
var ReactDOMOption = ReactCompositeComponent.createClass({
  displayName: 'ReactDOMOption',
  componentWillMount: function() {
    if (this.props.selected != null) {
      if ("production" !== process.env.NODE_ENV) {
        console.warn('Use the `defaultValue` or `value` props on <select> instead of ' + 'setting `selected` on <option>.');
      }
    }
  },
  render: function() {
    return option(this.props, this.props.children);
  }
});
module.exports = ReactDOMOption;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactCompositeComponent":43,"./ReactDOM":46,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],54:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMSelect";
"use strict";
var AutoFocusMixin = require("./AutoFocusMixin");
var LinkedValueUtils = require("./LinkedValueUtils");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var invariant = require("./invariant");
var merge = require("./merge");
var select = ReactDOM.select;
function selectValueType(props, propName, componentName) {
  if (props[propName] == null) {
    return;
  }
  if (props.multiple) {
    ("production" !== process.env.NODE_ENV ? invariant(Array.isArray(props[propName]), 'The `%s` prop supplied to <select> must be an array if `multiple` is ' + 'true.', propName) : invariant(Array.isArray(props[propName])));
  } else {
    ("production" !== process.env.NODE_ENV ? invariant(!Array.isArray(props[propName]), 'The `%s` prop supplied to <select> must be a scalar value if ' + '`multiple` is false.', propName) : invariant(!Array.isArray(props[propName])));
  }
}
function updateOptions(component, propValue) {
  var multiple = component.props.multiple;
  var value = propValue != null ? propValue : component.state.value;
  var options = component.getDOMNode().options;
  var selectedValue,
      i,
      l;
  if (multiple) {
    selectedValue = {};
    for (i = 0, l = value.length; i < l; ++i) {
      selectedValue['' + value[i]] = true;
    }
  } else {
    selectedValue = '' + value;
  }
  for (i = 0, l = options.length; i < l; i++) {
    var selected = multiple ? selectedValue.hasOwnProperty(options[i].value) : options[i].value === selectedValue;
    if (selected !== options[i].selected) {
      options[i].selected = selected;
    }
  }
}
var ReactDOMSelect = ReactCompositeComponent.createClass({
  displayName: 'ReactDOMSelect',
  mixins: [AutoFocusMixin, LinkedValueUtils.Mixin],
  propTypes: {
    defaultValue: selectValueType,
    value: selectValueType
  },
  getInitialState: function() {
    return {value: this.props.defaultValue || (this.props.multiple ? [] : '')};
  },
  componentWillReceiveProps: function(nextProps) {
    if (!this.props.multiple && nextProps.multiple) {
      this.setState({value: [this.state.value]});
    } else if (this.props.multiple && !nextProps.multiple) {
      this.setState({value: this.state.value[0]});
    }
  },
  shouldComponentUpdate: function() {
    return !this._isChanging;
  },
  render: function() {
    var props = merge(this.props);
    props.onChange = this._handleChange;
    props.value = null;
    return select(props, this.props.children);
  },
  componentDidMount: function() {
    updateOptions(this, LinkedValueUtils.getValue(this));
  },
  componentDidUpdate: function() {
    var value = LinkedValueUtils.getValue(this);
    if (value != null) {
      updateOptions(this, value);
    }
  },
  _handleChange: function(event) {
    var returnValue;
    var onChange = LinkedValueUtils.getOnChange(this);
    if (onChange) {
      this._isChanging = true;
      returnValue = onChange.call(this, event);
      this._isChanging = false;
    }
    var selectedValue;
    if (this.props.multiple) {
      selectedValue = [];
      var options = event.target.options;
      for (var i = 0,
          l = options.length; i < l; i++) {
        if (options[i].selected) {
          selectedValue.push(options[i].value);
        }
      }
    } else {
      selectedValue = event.target.value;
    }
    this.setState({value: selectedValue});
    return returnValue;
  }
});
module.exports = ReactDOMSelect;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./AutoFocusMixin":15,"./LinkedValueUtils":35,"./ReactCompositeComponent":43,"./ReactDOM":46,"./invariant":122,"./merge":131,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],55:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMSelection";
"use strict";
var getNodeForCharacterOffset = require("./getNodeForCharacterOffset");
var getTextContentAccessor = require("./getTextContentAccessor");
function getIEOffsets(node) {
  var selection = document.selection;
  var selectedRange = selection.createRange();
  var selectedLength = selectedRange.text.length;
  var fromStart = selectedRange.duplicate();
  fromStart.moveToElementText(node);
  fromStart.setEndPoint('EndToStart', selectedRange);
  var startOffset = fromStart.text.length;
  var endOffset = startOffset + selectedLength;
  return {
    start: startOffset,
    end: endOffset
  };
}
function getModernOffsets(node) {
  var selection = window.getSelection();
  if (selection.rangeCount === 0) {
    return null;
  }
  var anchorNode = selection.anchorNode;
  var anchorOffset = selection.anchorOffset;
  var focusNode = selection.focusNode;
  var focusOffset = selection.focusOffset;
  var currentRange = selection.getRangeAt(0);
  var rangeLength = currentRange.toString().length;
  var tempRange = currentRange.cloneRange();
  tempRange.selectNodeContents(node);
  tempRange.setEnd(currentRange.startContainer, currentRange.startOffset);
  var start = tempRange.toString().length;
  var end = start + rangeLength;
  var detectionRange = document.createRange();
  detectionRange.setStart(anchorNode, anchorOffset);
  detectionRange.setEnd(focusNode, focusOffset);
  var isBackward = detectionRange.collapsed;
  detectionRange.detach();
  return {
    start: isBackward ? end : start,
    end: isBackward ? start : end
  };
}
function setIEOffsets(node, offsets) {
  var range = document.selection.createRange().duplicate();
  var start,
      end;
  if (typeof offsets.end === 'undefined') {
    start = offsets.start;
    end = start;
  } else if (offsets.start > offsets.end) {
    start = offsets.end;
    end = offsets.start;
  } else {
    start = offsets.start;
    end = offsets.end;
  }
  range.moveToElementText(node);
  range.moveStart('character', start);
  range.setEndPoint('EndToStart', range);
  range.moveEnd('character', end - start);
  range.select();
}
function setModernOffsets(node, offsets) {
  var selection = window.getSelection();
  var length = node[getTextContentAccessor()].length;
  var start = Math.min(offsets.start, length);
  var end = typeof offsets.end === 'undefined' ? start : Math.min(offsets.end, length);
  if (!selection.extend && start > end) {
    var temp = end;
    end = start;
    start = temp;
  }
  var startMarker = getNodeForCharacterOffset(node, start);
  var endMarker = getNodeForCharacterOffset(node, end);
  if (startMarker && endMarker) {
    var range = document.createRange();
    range.setStart(startMarker.node, startMarker.offset);
    selection.removeAllRanges();
    if (start > end) {
      selection.addRange(range);
      selection.extend(endMarker.node, endMarker.offset);
    } else {
      range.setEnd(endMarker.node, endMarker.offset);
      selection.addRange(range);
    }
    range.detach();
  }
}
var ReactDOMSelection = {
  getOffsets: function(node) {
    var getOffsets = document.selection ? getIEOffsets : getModernOffsets;
    return getOffsets(node);
  },
  setOffsets: function(node, offsets) {
    var setOffsets = document.selection ? setIEOffsets : setModernOffsets;
    setOffsets(node, offsets);
  }
};
module.exports = ReactDOMSelection;


},{"./getNodeForCharacterOffset":117,"./getTextContentAccessor":119}],56:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDOMTextarea";
"use strict";
var AutoFocusMixin = require("./AutoFocusMixin");
var DOMPropertyOperations = require("./DOMPropertyOperations");
var LinkedValueUtils = require("./LinkedValueUtils");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var invariant = require("./invariant");
var merge = require("./merge");
var textarea = ReactDOM.textarea;
var ReactDOMTextarea = ReactCompositeComponent.createClass({
  displayName: 'ReactDOMTextarea',
  mixins: [AutoFocusMixin, LinkedValueUtils.Mixin],
  getInitialState: function() {
    var defaultValue = this.props.defaultValue;
    var children = this.props.children;
    if (children != null) {
      if ("production" !== process.env.NODE_ENV) {
        console.warn('Use the `defaultValue` or `value` props instead of setting ' + 'children on <textarea>.');
      }
      ("production" !== process.env.NODE_ENV ? invariant(defaultValue == null, 'If you supply `defaultValue` on a <textarea>, do not pass children.') : invariant(defaultValue == null));
      if (Array.isArray(children)) {
        ("production" !== process.env.NODE_ENV ? invariant(children.length <= 1, '<textarea> can only have at most one child.') : invariant(children.length <= 1));
        children = children[0];
      }
      defaultValue = '' + children;
    }
    if (defaultValue == null) {
      defaultValue = '';
    }
    var value = LinkedValueUtils.getValue(this);
    return {
      initialValue: '' + (value != null ? value : defaultValue),
      value: defaultValue
    };
  },
  shouldComponentUpdate: function() {
    return !this._isChanging;
  },
  render: function() {
    var props = merge(this.props);
    var value = LinkedValueUtils.getValue(this);
    ("production" !== process.env.NODE_ENV ? invariant(props.dangerouslySetInnerHTML == null, '`dangerouslySetInnerHTML` does not make sense on <textarea>.') : invariant(props.dangerouslySetInnerHTML == null));
    props.defaultValue = null;
    props.value = value != null ? value : this.state.value;
    props.onChange = this._handleChange;
    return textarea(props, this.state.initialValue);
  },
  componentDidUpdate: function(prevProps, prevState, prevContext) {
    var value = LinkedValueUtils.getValue(this);
    if (value != null) {
      var rootNode = this.getDOMNode();
      DOMPropertyOperations.setValueForProperty(rootNode, 'value', '' + value);
    }
  },
  _handleChange: function(event) {
    var returnValue;
    var onChange = LinkedValueUtils.getOnChange(this);
    if (onChange) {
      this._isChanging = true;
      returnValue = onChange.call(this, event);
      this._isChanging = false;
    }
    this.setState({value: event.target.value});
    return returnValue;
  }
});
module.exports = ReactDOMTextarea;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./AutoFocusMixin":15,"./DOMPropertyOperations":23,"./LinkedValueUtils":35,"./ReactCompositeComponent":43,"./ReactDOM":46,"./invariant":122,"./merge":131,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],57:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDefaultBatchingStrategy";
"use strict";
var ReactUpdates = require("./ReactUpdates");
var Transaction = require("./Transaction");
var emptyFunction = require("./emptyFunction");
var mixInto = require("./mixInto");
var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function() {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  }
};
var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};
var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];
function ReactDefaultBatchingStrategyTransaction() {
  this.reinitializeTransaction();
}
mixInto(ReactDefaultBatchingStrategyTransaction, Transaction.Mixin);
mixInto(ReactDefaultBatchingStrategyTransaction, {getTransactionWrappers: function() {
    return TRANSACTION_WRAPPERS;
  }});
var transaction = new ReactDefaultBatchingStrategyTransaction();
var ReactDefaultBatchingStrategy = {
  isBatchingUpdates: false,
  batchedUpdates: function(callback, param) {
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;
    ReactDefaultBatchingStrategy.isBatchingUpdates = true;
    if (alreadyBatchingUpdates) {
      callback(param);
    } else {
      transaction.perform(callback, null, param);
    }
  }
};
module.exports = ReactDefaultBatchingStrategy;


},{"./ReactUpdates":84,"./Transaction":98,"./emptyFunction":109,"./mixInto":134}],58:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDefaultInjection";
"use strict";
var ReactInjection = require("./ReactInjection");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var DefaultDOMPropertyConfig = require("./DefaultDOMPropertyConfig");
var ChangeEventPlugin = require("./ChangeEventPlugin");
var ClientReactRootIndex = require("./ClientReactRootIndex");
var CompositionEventPlugin = require("./CompositionEventPlugin");
var DefaultEventPluginOrder = require("./DefaultEventPluginOrder");
var EnterLeaveEventPlugin = require("./EnterLeaveEventPlugin");
var MobileSafariClickEventPlugin = require("./MobileSafariClickEventPlugin");
var ReactEventTopLevelCallback = require("./ReactEventTopLevelCallback");
var ReactDOM = require("./ReactDOM");
var ReactDOMButton = require("./ReactDOMButton");
var ReactDOMForm = require("./ReactDOMForm");
var ReactDOMImg = require("./ReactDOMImg");
var ReactDOMInput = require("./ReactDOMInput");
var ReactDOMOption = require("./ReactDOMOption");
var ReactDOMSelect = require("./ReactDOMSelect");
var ReactDOMTextarea = require("./ReactDOMTextarea");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactMount = require("./ReactMount");
var SelectEventPlugin = require("./SelectEventPlugin");
var ServerReactRootIndex = require("./ServerReactRootIndex");
var SimpleEventPlugin = require("./SimpleEventPlugin");
var ReactDefaultBatchingStrategy = require("./ReactDefaultBatchingStrategy");
var createFullPageComponent = require("./createFullPageComponent");
function inject() {
  ReactInjection.EventEmitter.injectTopLevelCallbackCreator(ReactEventTopLevelCallback);
  ReactInjection.EventPluginHub.injectEventPluginOrder(DefaultEventPluginOrder);
  ReactInjection.EventPluginHub.injectInstanceHandle(ReactInstanceHandles);
  ReactInjection.EventPluginHub.injectMount(ReactMount);
  ReactInjection.EventPluginHub.injectEventPluginsByName({
    SimpleEventPlugin: SimpleEventPlugin,
    EnterLeaveEventPlugin: EnterLeaveEventPlugin,
    ChangeEventPlugin: ChangeEventPlugin,
    CompositionEventPlugin: CompositionEventPlugin,
    MobileSafariClickEventPlugin: MobileSafariClickEventPlugin,
    SelectEventPlugin: SelectEventPlugin
  });
  ReactInjection.DOM.injectComponentClasses({
    button: ReactDOMButton,
    form: ReactDOMForm,
    img: ReactDOMImg,
    input: ReactDOMInput,
    option: ReactDOMOption,
    select: ReactDOMSelect,
    textarea: ReactDOMTextarea,
    html: createFullPageComponent(ReactDOM.html),
    head: createFullPageComponent(ReactDOM.head),
    title: createFullPageComponent(ReactDOM.title),
    body: createFullPageComponent(ReactDOM.body)
  });
  ReactInjection.DOMProperty.injectDOMPropertyConfig(DefaultDOMPropertyConfig);
  ReactInjection.Updates.injectBatchingStrategy(ReactDefaultBatchingStrategy);
  ReactInjection.RootIndex.injectCreateReactRootIndex(ExecutionEnvironment.canUseDOM ? ClientReactRootIndex.createReactRootIndex : ServerReactRootIndex.createReactRootIndex);
  if ("production" !== process.env.NODE_ENV) {
    var url = (ExecutionEnvironment.canUseDOM && window.location.href) || '';
    if ((/[?&]react_perf\b/).test(url)) {
      var ReactDefaultPerf = require("./ReactDefaultPerf");
      ReactDefaultPerf.start();
    }
  }
}
module.exports = {inject: inject};


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ChangeEventPlugin":18,"./ClientReactRootIndex":19,"./CompositionEventPlugin":20,"./DefaultDOMPropertyConfig":25,"./DefaultEventPluginOrder":26,"./EnterLeaveEventPlugin":27,"./ExecutionEnvironment":34,"./MobileSafariClickEventPlugin":36,"./ReactDOM":46,"./ReactDOMButton":47,"./ReactDOMForm":49,"./ReactDOMImg":51,"./ReactDOMInput":52,"./ReactDOMOption":53,"./ReactDOMSelect":54,"./ReactDOMTextarea":56,"./ReactDefaultBatchingStrategy":57,"./ReactDefaultPerf":59,"./ReactEventTopLevelCallback":64,"./ReactInjection":65,"./ReactInstanceHandles":67,"./ReactMount":69,"./SelectEventPlugin":85,"./ServerReactRootIndex":86,"./SimpleEventPlugin":87,"./createFullPageComponent":105,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],59:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDefaultPerf";
"use strict";
var DOMProperty = require("./DOMProperty");
var ReactDefaultPerfAnalysis = require("./ReactDefaultPerfAnalysis");
var ReactMount = require("./ReactMount");
var ReactPerf = require("./ReactPerf");
var performanceNow = require("./performanceNow");
function roundFloat(val) {
  return Math.floor(val * 100) / 100;
}
var ReactDefaultPerf = {
  _allMeasurements: [],
  _injected: false,
  start: function() {
    if (!ReactDefaultPerf._injected) {
      ReactPerf.injection.injectMeasure(ReactDefaultPerf.measure);
    }
    ReactDefaultPerf._allMeasurements.length = 0;
    ReactPerf.enableMeasure = true;
  },
  stop: function() {
    ReactPerf.enableMeasure = false;
  },
  getLastMeasurements: function() {
    return ReactDefaultPerf._allMeasurements;
  },
  printExclusive: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getExclusiveSummary(measurements);
    console.table(summary.map(function(item) {
      return {
        'Component class name': item.componentName,
        'Total inclusive time (ms)': roundFloat(item.inclusive),
        'Total exclusive time (ms)': roundFloat(item.exclusive),
        'Exclusive time per instance (ms)': roundFloat(item.exclusive / item.count),
        'Instances': item.count
      };
    }));
    console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
  },
  printInclusive: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(measurements);
    console.table(summary.map(function(item) {
      return {
        'Owner > component': item.componentName,
        'Inclusive time (ms)': roundFloat(item.time),
        'Instances': item.count
      };
    }));
    console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
  },
  printWasted: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(measurements, true);
    console.table(summary.map(function(item) {
      return {
        'Owner > component': item.componentName,
        'Wasted time (ms)': item.time,
        'Instances': item.count
      };
    }));
    console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
  },
  printDOM: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getDOMSummary(measurements);
    console.table(summary.map(function(item) {
      var result = {};
      result[DOMProperty.ID_ATTRIBUTE_NAME] = item.id;
      result['type'] = item.type;
      result['args'] = JSON.stringify(item.args);
      return result;
    }));
    console.log('Total time:', ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms');
  },
  _recordWrite: function(id, fnName, totalTime, args) {
    var writes = ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1].writes;
    writes[id] = writes[id] || [];
    writes[id].push({
      type: fnName,
      time: totalTime,
      args: args
    });
  },
  measure: function(moduleName, fnName, func) {
    return function() {
      var args = Array.prototype.slice.call(arguments, 0);
      var totalTime;
      var rv;
      var start;
      if (fnName === '_renderNewRootComponent' || fnName === 'flushBatchedUpdates') {
        ReactDefaultPerf._allMeasurements.push({
          exclusive: {},
          inclusive: {},
          counts: {},
          writes: {},
          displayNames: {},
          totalTime: 0
        });
        start = performanceNow();
        rv = func.apply(this, args);
        ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1].totalTime = performanceNow() - start;
        return rv;
      } else if (moduleName === 'ReactDOMIDOperations' || moduleName === 'ReactComponentBrowserEnvironment') {
        start = performanceNow();
        rv = func.apply(this, args);
        totalTime = performanceNow() - start;
        if (fnName === 'mountImageIntoNode') {
          var mountID = ReactMount.getID(args[1]);
          ReactDefaultPerf._recordWrite(mountID, fnName, totalTime, args[0]);
        } else if (fnName === 'dangerouslyProcessChildrenUpdates') {
          args[0].forEach(function(update) {
            var writeArgs = {};
            if (update.fromIndex !== null) {
              writeArgs.fromIndex = update.fromIndex;
            }
            if (update.toIndex !== null) {
              writeArgs.toIndex = update.toIndex;
            }
            if (update.textContent !== null) {
              writeArgs.textContent = update.textContent;
            }
            if (update.markupIndex !== null) {
              writeArgs.markup = args[1][update.markupIndex];
            }
            ReactDefaultPerf._recordWrite(update.parentID, update.type, totalTime, writeArgs);
          });
        } else {
          ReactDefaultPerf._recordWrite(args[0], fnName, totalTime, Array.prototype.slice.call(args, 1));
        }
        return rv;
      } else if (moduleName === 'ReactCompositeComponent' && (fnName === 'mountComponent' || fnName === 'updateComponent' || fnName === '_renderValidatedComponent')) {
        var rootNodeID = fnName === 'mountComponent' ? args[0] : this._rootNodeID;
        var isRender = fnName === '_renderValidatedComponent';
        var entry = ReactDefaultPerf._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1];
        if (isRender) {
          entry.counts[rootNodeID] = entry.counts[rootNodeID] || 0;
          entry.counts[rootNodeID] += 1;
        }
        start = performanceNow();
        rv = func.apply(this, args);
        totalTime = performanceNow() - start;
        var typeOfLog = isRender ? entry.exclusive : entry.inclusive;
        typeOfLog[rootNodeID] = typeOfLog[rootNodeID] || 0;
        typeOfLog[rootNodeID] += totalTime;
        entry.displayNames[rootNodeID] = {
          current: this.constructor.displayName,
          owner: this._owner ? this._owner.constructor.displayName : '<root>'
        };
        return rv;
      } else {
        return func.apply(this, args);
      }
    };
  }
};
module.exports = ReactDefaultPerf;


},{"./DOMProperty":22,"./ReactDefaultPerfAnalysis":60,"./ReactMount":69,"./ReactPerf":74,"./performanceNow":138}],60:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactDefaultPerfAnalysis";
var merge = require("./merge");
var DONT_CARE_THRESHOLD = 1.2;
var DOM_OPERATION_TYPES = {
  'mountImageIntoNode': 'set innerHTML',
  INSERT_MARKUP: 'set innerHTML',
  MOVE_EXISTING: 'move',
  REMOVE_NODE: 'remove',
  TEXT_CONTENT: 'set textContent',
  'updatePropertyByID': 'update attribute',
  'deletePropertyByID': 'delete attribute',
  'updateStylesByID': 'update styles',
  'updateInnerHTMLByID': 'set innerHTML',
  'dangerouslyReplaceNodeWithMarkupByID': 'replace'
};
function getTotalTime(measurements) {
  var totalTime = 0;
  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    totalTime += measurement.totalTime;
  }
  return totalTime;
}
function getDOMSummary(measurements) {
  var items = [];
  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var id;
    for (id in measurement.writes) {
      measurement.writes[id].forEach(function(write) {
        items.push({
          id: id,
          type: DOM_OPERATION_TYPES[write.type] || write.type,
          args: write.args
        });
      });
    }
  }
  return items;
}
function getExclusiveSummary(measurements) {
  var candidates = {};
  var displayName;
  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var allIDs = merge(measurement.exclusive, measurement.inclusive);
    for (var id in allIDs) {
      displayName = measurement.displayNames[id].current;
      candidates[displayName] = candidates[displayName] || {
        componentName: displayName,
        inclusive: 0,
        exclusive: 0,
        count: 0
      };
      if (measurement.exclusive[id]) {
        candidates[displayName].exclusive += measurement.exclusive[id];
      }
      if (measurement.inclusive[id]) {
        candidates[displayName].inclusive += measurement.inclusive[id];
      }
      if (measurement.counts[id]) {
        candidates[displayName].count += measurement.counts[id];
      }
    }
  }
  var arr = [];
  for (displayName in candidates) {
    if (candidates[displayName].exclusive >= DONT_CARE_THRESHOLD) {
      arr.push(candidates[displayName]);
    }
  }
  arr.sort(function(a, b) {
    return b.exclusive - a.exclusive;
  });
  return arr;
}
function getInclusiveSummary(measurements, onlyClean) {
  var candidates = {};
  var inclusiveKey;
  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var allIDs = merge(measurement.exclusive, measurement.inclusive);
    var cleanComponents;
    if (onlyClean) {
      cleanComponents = getUnchangedComponents(measurement);
    }
    for (var id in allIDs) {
      if (onlyClean && !cleanComponents[id]) {
        continue;
      }
      var displayName = measurement.displayNames[id];
      inclusiveKey = displayName.owner + ' > ' + displayName.current;
      candidates[inclusiveKey] = candidates[inclusiveKey] || {
        componentName: inclusiveKey,
        time: 0,
        count: 0
      };
      if (measurement.inclusive[id]) {
        candidates[inclusiveKey].time += measurement.inclusive[id];
      }
      if (measurement.counts[id]) {
        candidates[inclusiveKey].count += measurement.counts[id];
      }
    }
  }
  var arr = [];
  for (inclusiveKey in candidates) {
    if (candidates[inclusiveKey].time >= DONT_CARE_THRESHOLD) {
      arr.push(candidates[inclusiveKey]);
    }
  }
  arr.sort(function(a, b) {
    return b.time - a.time;
  });
  return arr;
}
function getUnchangedComponents(measurement) {
  var cleanComponents = {};
  var dirtyLeafIDs = Object.keys(measurement.writes);
  var allIDs = merge(measurement.exclusive, measurement.inclusive);
  for (var id in allIDs) {
    var isDirty = false;
    for (var i = 0; i < dirtyLeafIDs.length; i++) {
      if (dirtyLeafIDs[i].indexOf(id) === 0) {
        isDirty = true;
        break;
      }
    }
    if (!isDirty && measurement.counts[id] > 0) {
      cleanComponents[id] = true;
    }
  }
  return cleanComponents;
}
var ReactDefaultPerfAnalysis = {
  getExclusiveSummary: getExclusiveSummary,
  getInclusiveSummary: getInclusiveSummary,
  getDOMSummary: getDOMSummary,
  getTotalTime: getTotalTime
};
module.exports = ReactDefaultPerfAnalysis;


},{"./merge":131}],61:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactErrorUtils";
"use strict";
var ReactErrorUtils = {guard: function(func, name) {
    return func;
  }};
module.exports = ReactErrorUtils;


},{}],62:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactEventEmitter";
"use strict";
var EventConstants = require("./EventConstants");
var EventListener = require("./EventListener");
var EventPluginHub = require("./EventPluginHub");
var EventPluginRegistry = require("./EventPluginRegistry");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var ReactEventEmitterMixin = require("./ReactEventEmitterMixin");
var ViewportMetrics = require("./ViewportMetrics");
var invariant = require("./invariant");
var isEventSupported = require("./isEventSupported");
var merge = require("./merge");
var alreadyListeningTo = {};
var isMonitoringScrollValue = false;
var reactTopListenersCounter = 0;
var topEventMapping = {
  topBlur: 'blur',
  topChange: 'change',
  topClick: 'click',
  topCompositionEnd: 'compositionend',
  topCompositionStart: 'compositionstart',
  topCompositionUpdate: 'compositionupdate',
  topContextMenu: 'contextmenu',
  topCopy: 'copy',
  topCut: 'cut',
  topDoubleClick: 'dblclick',
  topDrag: 'drag',
  topDragEnd: 'dragend',
  topDragEnter: 'dragenter',
  topDragExit: 'dragexit',
  topDragLeave: 'dragleave',
  topDragOver: 'dragover',
  topDragStart: 'dragstart',
  topDrop: 'drop',
  topFocus: 'focus',
  topInput: 'input',
  topKeyDown: 'keydown',
  topKeyPress: 'keypress',
  topKeyUp: 'keyup',
  topMouseDown: 'mousedown',
  topMouseMove: 'mousemove',
  topMouseOut: 'mouseout',
  topMouseOver: 'mouseover',
  topMouseUp: 'mouseup',
  topPaste: 'paste',
  topScroll: 'scroll',
  topSelectionChange: 'selectionchange',
  topTouchCancel: 'touchcancel',
  topTouchEnd: 'touchend',
  topTouchMove: 'touchmove',
  topTouchStart: 'touchstart',
  topWheel: 'wheel'
};
var topListenersIDKey = "_reactListenersID" + String(Math.random()).slice(2);
function getListeningForDocument(mountAt) {
  if (mountAt[topListenersIDKey] == null) {
    mountAt[topListenersIDKey] = reactTopListenersCounter++;
    alreadyListeningTo[mountAt[topListenersIDKey]] = {};
  }
  return alreadyListeningTo[mountAt[topListenersIDKey]];
}
function trapBubbledEvent(topLevelType, handlerBaseName, element) {
  EventListener.listen(element, handlerBaseName, ReactEventEmitter.TopLevelCallbackCreator.createTopLevelCallback(topLevelType));
}
function trapCapturedEvent(topLevelType, handlerBaseName, element) {
  EventListener.capture(element, handlerBaseName, ReactEventEmitter.TopLevelCallbackCreator.createTopLevelCallback(topLevelType));
}
var ReactEventEmitter = merge(ReactEventEmitterMixin, {
  TopLevelCallbackCreator: null,
  injection: {injectTopLevelCallbackCreator: function(TopLevelCallbackCreator) {
      ReactEventEmitter.TopLevelCallbackCreator = TopLevelCallbackCreator;
    }},
  setEnabled: function(enabled) {
    ("production" !== process.env.NODE_ENV ? invariant(ExecutionEnvironment.canUseDOM, 'setEnabled(...): Cannot toggle event listening in a Worker thread. ' + 'This is likely a bug in the framework. Please report immediately.') : invariant(ExecutionEnvironment.canUseDOM));
    if (ReactEventEmitter.TopLevelCallbackCreator) {
      ReactEventEmitter.TopLevelCallbackCreator.setEnabled(enabled);
    }
  },
  isEnabled: function() {
    return !!(ReactEventEmitter.TopLevelCallbackCreator && ReactEventEmitter.TopLevelCallbackCreator.isEnabled());
  },
  listenTo: function(registrationName, contentDocument) {
    var mountAt = contentDocument;
    var isListening = getListeningForDocument(mountAt);
    var dependencies = EventPluginRegistry.registrationNameDependencies[registrationName];
    var topLevelTypes = EventConstants.topLevelTypes;
    for (var i = 0,
        l = dependencies.length; i < l; i++) {
      var dependency = dependencies[i];
      if (!isListening[dependency]) {
        var topLevelType = topLevelTypes[dependency];
        if (topLevelType === topLevelTypes.topWheel) {
          if (isEventSupported('wheel')) {
            trapBubbledEvent(topLevelTypes.topWheel, 'wheel', mountAt);
          } else if (isEventSupported('mousewheel')) {
            trapBubbledEvent(topLevelTypes.topWheel, 'mousewheel', mountAt);
          } else {
            trapBubbledEvent(topLevelTypes.topWheel, 'DOMMouseScroll', mountAt);
          }
        } else if (topLevelType === topLevelTypes.topScroll) {
          if (isEventSupported('scroll', true)) {
            trapCapturedEvent(topLevelTypes.topScroll, 'scroll', mountAt);
          } else {
            trapBubbledEvent(topLevelTypes.topScroll, 'scroll', window);
          }
        } else if (topLevelType === topLevelTypes.topFocus || topLevelType === topLevelTypes.topBlur) {
          if (isEventSupported('focus', true)) {
            trapCapturedEvent(topLevelTypes.topFocus, 'focus', mountAt);
            trapCapturedEvent(topLevelTypes.topBlur, 'blur', mountAt);
          } else if (isEventSupported('focusin')) {
            trapBubbledEvent(topLevelTypes.topFocus, 'focusin', mountAt);
            trapBubbledEvent(topLevelTypes.topBlur, 'focusout', mountAt);
          }
          isListening[topLevelTypes.topBlur] = true;
          isListening[topLevelTypes.topFocus] = true;
        } else if (topEventMapping[dependency]) {
          trapBubbledEvent(topLevelType, topEventMapping[dependency], mountAt);
        }
        isListening[dependency] = true;
      }
    }
  },
  ensureScrollValueMonitoring: function() {
    if (!isMonitoringScrollValue) {
      var refresh = ViewportMetrics.refreshScrollValues;
      EventListener.listen(window, 'scroll', refresh);
      EventListener.listen(window, 'resize', refresh);
      isMonitoringScrollValue = true;
    }
  },
  eventNameDispatchConfigs: EventPluginHub.eventNameDispatchConfigs,
  registrationNameModules: EventPluginHub.registrationNameModules,
  putListener: EventPluginHub.putListener,
  getListener: EventPluginHub.getListener,
  deleteListener: EventPluginHub.deleteListener,
  deleteAllListeners: EventPluginHub.deleteAllListeners,
  trapBubbledEvent: trapBubbledEvent,
  trapCapturedEvent: trapCapturedEvent
});
module.exports = ReactEventEmitter;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./EventConstants":28,"./EventListener":29,"./EventPluginHub":30,"./EventPluginRegistry":31,"./ExecutionEnvironment":34,"./ReactEventEmitterMixin":63,"./ViewportMetrics":99,"./invariant":122,"./isEventSupported":123,"./merge":131,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],63:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactEventEmitterMixin";
"use strict";
var EventPluginHub = require("./EventPluginHub");
var ReactUpdates = require("./ReactUpdates");
function runEventQueueInBatch(events) {
  EventPluginHub.enqueueEvents(events);
  EventPluginHub.processEventQueue();
}
var ReactEventEmitterMixin = {handleTopLevel: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    var events = EventPluginHub.extractEvents(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent);
    ReactUpdates.batchedUpdates(runEventQueueInBatch, events);
  }};
module.exports = ReactEventEmitterMixin;


},{"./EventPluginHub":30,"./ReactUpdates":84}],64:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactEventTopLevelCallback";
"use strict";
var PooledClass = require("./PooledClass");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactMount = require("./ReactMount");
var getEventTarget = require("./getEventTarget");
var mixInto = require("./mixInto");
var _topLevelListenersEnabled = true;
function findParent(node) {
  var nodeID = ReactMount.getID(node);
  var rootID = ReactInstanceHandles.getReactRootIDFromNodeID(nodeID);
  var container = ReactMount.findReactContainerForID(rootID);
  var parent = ReactMount.getFirstReactDOM(container);
  return parent;
}
function handleTopLevelImpl(topLevelType, nativeEvent, bookKeeping) {
  var topLevelTarget = ReactMount.getFirstReactDOM(getEventTarget(nativeEvent)) || window;
  var ancestor = topLevelTarget;
  while (ancestor) {
    bookKeeping.ancestors.push(ancestor);
    ancestor = findParent(ancestor);
  }
  for (var i = 0,
      l = bookKeeping.ancestors.length; i < l; i++) {
    topLevelTarget = bookKeeping.ancestors[i];
    var topLevelTargetID = ReactMount.getID(topLevelTarget) || '';
    ReactEventEmitter.handleTopLevel(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent);
  }
}
function TopLevelCallbackBookKeeping() {
  this.ancestors = [];
}
mixInto(TopLevelCallbackBookKeeping, {destructor: function() {
    this.ancestors.length = 0;
  }});
PooledClass.addPoolingTo(TopLevelCallbackBookKeeping);
var ReactEventTopLevelCallback = {
  setEnabled: function(enabled) {
    _topLevelListenersEnabled = !!enabled;
  },
  isEnabled: function() {
    return _topLevelListenersEnabled;
  },
  createTopLevelCallback: function(topLevelType) {
    return function(nativeEvent) {
      if (!_topLevelListenersEnabled) {
        return;
      }
      var bookKeeping = TopLevelCallbackBookKeeping.getPooled();
      try {
        handleTopLevelImpl(topLevelType, nativeEvent, bookKeeping);
      } finally {
        TopLevelCallbackBookKeeping.release(bookKeeping);
      }
    };
  }
};
module.exports = ReactEventTopLevelCallback;


},{"./PooledClass":37,"./ReactEventEmitter":62,"./ReactInstanceHandles":67,"./ReactMount":69,"./getEventTarget":115,"./mixInto":134}],65:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactInjection";
"use strict";
var DOMProperty = require("./DOMProperty");
var EventPluginHub = require("./EventPluginHub");
var ReactDOM = require("./ReactDOM");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactPerf = require("./ReactPerf");
var ReactRootIndex = require("./ReactRootIndex");
var ReactUpdates = require("./ReactUpdates");
var ReactInjection = {
  DOMProperty: DOMProperty.injection,
  EventPluginHub: EventPluginHub.injection,
  DOM: ReactDOM.injection,
  EventEmitter: ReactEventEmitter.injection,
  Perf: ReactPerf.injection,
  RootIndex: ReactRootIndex.injection,
  Updates: ReactUpdates.injection
};
module.exports = ReactInjection;


},{"./DOMProperty":22,"./EventPluginHub":30,"./ReactDOM":46,"./ReactEventEmitter":62,"./ReactPerf":74,"./ReactRootIndex":81,"./ReactUpdates":84}],66:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactInputSelection";
"use strict";
var ReactDOMSelection = require("./ReactDOMSelection");
var containsNode = require("./containsNode");
var getActiveElement = require("./getActiveElement");
function isInDocument(node) {
  return containsNode(document.documentElement, node);
}
var ReactInputSelection = {
  hasSelectionCapabilities: function(elem) {
    return elem && ((elem.nodeName === 'INPUT' && elem.type === 'text') || elem.nodeName === 'TEXTAREA' || elem.contentEditable === 'true');
  },
  getSelectionInformation: function() {
    var focusedElem = getActiveElement();
    return {
      focusedElem: focusedElem,
      selectionRange: ReactInputSelection.hasSelectionCapabilities(focusedElem) ? ReactInputSelection.getSelection(focusedElem) : null
    };
  },
  restoreSelection: function(priorSelectionInformation) {
    var curFocusedElem = getActiveElement();
    var priorFocusedElem = priorSelectionInformation.focusedElem;
    var priorSelectionRange = priorSelectionInformation.selectionRange;
    if (curFocusedElem !== priorFocusedElem && isInDocument(priorFocusedElem)) {
      if (ReactInputSelection.hasSelectionCapabilities(priorFocusedElem)) {
        ReactInputSelection.setSelection(priorFocusedElem, priorSelectionRange);
      }
      priorFocusedElem.focus();
    }
  },
  getSelection: function(input) {
    var selection;
    if ('selectionStart' in input) {
      selection = {
        start: input.selectionStart,
        end: input.selectionEnd
      };
    } else if (document.selection && input.nodeName === 'INPUT') {
      var range = document.selection.createRange();
      if (range.parentElement() === input) {
        selection = {
          start: -range.moveStart('character', -input.value.length),
          end: -range.moveEnd('character', -input.value.length)
        };
      }
    } else {
      selection = ReactDOMSelection.getOffsets(input);
    }
    return selection || {
      start: 0,
      end: 0
    };
  },
  setSelection: function(input, offsets) {
    var start = offsets.start;
    var end = offsets.end;
    if (typeof end === 'undefined') {
      end = start;
    }
    if ('selectionStart' in input) {
      input.selectionStart = start;
      input.selectionEnd = Math.min(end, input.value.length);
    } else if (document.selection && input.nodeName === 'INPUT') {
      var range = input.createTextRange();
      range.collapse(true);
      range.moveStart('character', start);
      range.moveEnd('character', end - start);
      range.select();
    } else {
      ReactDOMSelection.setOffsets(input, offsets);
    }
  }
};
module.exports = ReactInputSelection;


},{"./ReactDOMSelection":55,"./containsNode":102,"./getActiveElement":113}],67:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactInstanceHandles";
"use strict";
var ReactRootIndex = require("./ReactRootIndex");
var invariant = require("./invariant");
var SEPARATOR = '.';
var SEPARATOR_LENGTH = SEPARATOR.length;
var MAX_TREE_DEPTH = 100;
function getReactRootIDString(index) {
  return SEPARATOR + index.toString(36);
}
function isBoundary(id, index) {
  return id.charAt(index) === SEPARATOR || index === id.length;
}
function isValidID(id) {
  return id === '' || (id.charAt(0) === SEPARATOR && id.charAt(id.length - 1) !== SEPARATOR);
}
function isAncestorIDOf(ancestorID, descendantID) {
  return (descendantID.indexOf(ancestorID) === 0 && isBoundary(descendantID, ancestorID.length));
}
function getParentID(id) {
  return id ? id.substr(0, id.lastIndexOf(SEPARATOR)) : '';
}
function getNextDescendantID(ancestorID, destinationID) {
  ("production" !== process.env.NODE_ENV ? invariant(isValidID(ancestorID) && isValidID(destinationID), 'getNextDescendantID(%s, %s): Received an invalid React DOM ID.', ancestorID, destinationID) : invariant(isValidID(ancestorID) && isValidID(destinationID)));
  ("production" !== process.env.NODE_ENV ? invariant(isAncestorIDOf(ancestorID, destinationID), 'getNextDescendantID(...): React has made an invalid assumption about ' + 'the DOM hierarchy. Expected `%s` to be an ancestor of `%s`.', ancestorID, destinationID) : invariant(isAncestorIDOf(ancestorID, destinationID)));
  if (ancestorID === destinationID) {
    return ancestorID;
  }
  var start = ancestorID.length + SEPARATOR_LENGTH;
  for (var i = start; i < destinationID.length; i++) {
    if (isBoundary(destinationID, i)) {
      break;
    }
  }
  return destinationID.substr(0, i);
}
function getFirstCommonAncestorID(oneID, twoID) {
  var minLength = Math.min(oneID.length, twoID.length);
  if (minLength === 0) {
    return '';
  }
  var lastCommonMarkerIndex = 0;
  for (var i = 0; i <= minLength; i++) {
    if (isBoundary(oneID, i) && isBoundary(twoID, i)) {
      lastCommonMarkerIndex = i;
    } else if (oneID.charAt(i) !== twoID.charAt(i)) {
      break;
    }
  }
  var longestCommonID = oneID.substr(0, lastCommonMarkerIndex);
  ("production" !== process.env.NODE_ENV ? invariant(isValidID(longestCommonID), 'getFirstCommonAncestorID(%s, %s): Expected a valid React DOM ID: %s', oneID, twoID, longestCommonID) : invariant(isValidID(longestCommonID)));
  return longestCommonID;
}
function traverseParentPath(start, stop, cb, arg, skipFirst, skipLast) {
  start = start || '';
  stop = stop || '';
  ("production" !== process.env.NODE_ENV ? invariant(start !== stop, 'traverseParentPath(...): Cannot traverse from and to the same ID, `%s`.', start) : invariant(start !== stop));
  var traverseUp = isAncestorIDOf(stop, start);
  ("production" !== process.env.NODE_ENV ? invariant(traverseUp || isAncestorIDOf(start, stop), 'traverseParentPath(%s, %s, ...): Cannot traverse from two IDs that do ' + 'not have a parent path.', start, stop) : invariant(traverseUp || isAncestorIDOf(start, stop)));
  var depth = 0;
  var traverse = traverseUp ? getParentID : getNextDescendantID;
  for (var id = start; ; id = traverse(id, stop)) {
    var ret;
    if ((!skipFirst || id !== start) && (!skipLast || id !== stop)) {
      ret = cb(id, traverseUp, arg);
    }
    if (ret === false || id === stop) {
      break;
    }
    ("production" !== process.env.NODE_ENV ? invariant(depth++ < MAX_TREE_DEPTH, 'traverseParentPath(%s, %s, ...): Detected an infinite loop while ' + 'traversing the React DOM ID tree. This may be due to malformed IDs: %s', start, stop) : invariant(depth++ < MAX_TREE_DEPTH));
  }
}
var ReactInstanceHandles = {
  createReactRootID: function() {
    return getReactRootIDString(ReactRootIndex.createReactRootIndex());
  },
  createReactID: function(rootID, name) {
    return rootID + name;
  },
  getReactRootIDFromNodeID: function(id) {
    if (id && id.charAt(0) === SEPARATOR && id.length > 1) {
      var index = id.indexOf(SEPARATOR, 1);
      return index > -1 ? id.substr(0, index) : id;
    }
    return null;
  },
  traverseEnterLeave: function(leaveID, enterID, cb, upArg, downArg) {
    var ancestorID = getFirstCommonAncestorID(leaveID, enterID);
    if (ancestorID !== leaveID) {
      traverseParentPath(leaveID, ancestorID, cb, upArg, false, true);
    }
    if (ancestorID !== enterID) {
      traverseParentPath(ancestorID, enterID, cb, downArg, true, false);
    }
  },
  traverseTwoPhase: function(targetID, cb, arg) {
    if (targetID) {
      traverseParentPath('', targetID, cb, arg, true, false);
      traverseParentPath(targetID, '', cb, arg, false, true);
    }
  },
  traverseAncestors: function(targetID, cb, arg) {
    traverseParentPath('', targetID, cb, arg, true, false);
  },
  _getFirstCommonAncestorID: getFirstCommonAncestorID,
  _getNextDescendantID: getNextDescendantID,
  isAncestorIDOf: isAncestorIDOf,
  SEPARATOR: SEPARATOR
};
module.exports = ReactInstanceHandles;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactRootIndex":81,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],68:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactMarkupChecksum";
"use strict";
var adler32 = require("./adler32");
var ReactMarkupChecksum = {
  CHECKSUM_ATTR_NAME: 'data-react-checksum',
  addChecksumToMarkup: function(markup) {
    var checksum = adler32(markup);
    return markup.replace('>', ' ' + ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="' + checksum + '">');
  },
  canReuseMarkup: function(markup, element) {
    var existingChecksum = element.getAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);
    existingChecksum = existingChecksum && parseInt(existingChecksum, 10);
    var markupChecksum = adler32(markup);
    return markupChecksum === existingChecksum;
  }
};
module.exports = ReactMarkupChecksum;


},{"./adler32":101}],69:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactMount";
"use strict";
var DOMProperty = require("./DOMProperty");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactPerf = require("./ReactPerf");
var containsNode = require("./containsNode");
var getReactRootElementInContainer = require("./getReactRootElementInContainer");
var invariant = require("./invariant");
var shouldUpdateReactComponent = require("./shouldUpdateReactComponent");
var SEPARATOR = ReactInstanceHandles.SEPARATOR;
var ATTR_NAME = DOMProperty.ID_ATTRIBUTE_NAME;
var nodeCache = {};
var ELEMENT_NODE_TYPE = 1;
var DOC_NODE_TYPE = 9;
var instancesByReactRootID = {};
var containersByReactRootID = {};
if ("production" !== process.env.NODE_ENV) {
  var rootElementsByReactRootID = {};
}
var findComponentRootReusableArray = [];
function getReactRootID(container) {
  var rootElement = getReactRootElementInContainer(container);
  return rootElement && ReactMount.getID(rootElement);
}
function getID(node) {
  var id = internalGetID(node);
  if (id) {
    if (nodeCache.hasOwnProperty(id)) {
      var cached = nodeCache[id];
      if (cached !== node) {
        ("production" !== process.env.NODE_ENV ? invariant(!isValid(cached, id), 'ReactMount: Two valid but unequal nodes with the same `%s`: %s', ATTR_NAME, id) : invariant(!isValid(cached, id)));
        nodeCache[id] = node;
      }
    } else {
      nodeCache[id] = node;
    }
  }
  return id;
}
function internalGetID(node) {
  return node && node.getAttribute && node.getAttribute(ATTR_NAME) || '';
}
function setID(node, id) {
  var oldID = internalGetID(node);
  if (oldID !== id) {
    delete nodeCache[oldID];
  }
  node.setAttribute(ATTR_NAME, id);
  nodeCache[id] = node;
}
function getNode(id) {
  if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
    nodeCache[id] = ReactMount.findReactNodeByID(id);
  }
  return nodeCache[id];
}
function isValid(node, id) {
  if (node) {
    ("production" !== process.env.NODE_ENV ? invariant(internalGetID(node) === id, 'ReactMount: Unexpected modification of `%s`', ATTR_NAME) : invariant(internalGetID(node) === id));
    var container = ReactMount.findReactContainerForID(id);
    if (container && containsNode(container, node)) {
      return true;
    }
  }
  return false;
}
function purgeID(id) {
  delete nodeCache[id];
}
var deepestNodeSoFar = null;
function findDeepestCachedAncestorImpl(ancestorID) {
  var ancestor = nodeCache[ancestorID];
  if (ancestor && isValid(ancestor, ancestorID)) {
    deepestNodeSoFar = ancestor;
  } else {
    return false;
  }
}
function findDeepestCachedAncestor(targetID) {
  deepestNodeSoFar = null;
  ReactInstanceHandles.traverseAncestors(targetID, findDeepestCachedAncestorImpl);
  var foundNode = deepestNodeSoFar;
  deepestNodeSoFar = null;
  return foundNode;
}
var ReactMount = {
  totalInstantiationTime: 0,
  totalInjectionTime: 0,
  useTouchEvents: false,
  _instancesByReactRootID: instancesByReactRootID,
  scrollMonitor: function(container, renderCallback) {
    renderCallback();
  },
  _updateRootComponent: function(prevComponent, nextComponent, container, callback) {
    var nextProps = nextComponent.props;
    ReactMount.scrollMonitor(container, function() {
      prevComponent.replaceProps(nextProps, callback);
    });
    if ("production" !== process.env.NODE_ENV) {
      rootElementsByReactRootID[getReactRootID(container)] = getReactRootElementInContainer(container);
    }
    return prevComponent;
  },
  _registerComponent: function(nextComponent, container) {
    ("production" !== process.env.NODE_ENV ? invariant(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE), '_registerComponent(...): Target container is not a DOM element.') : invariant(container && (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)));
    ReactEventEmitter.ensureScrollValueMonitoring();
    var reactRootID = ReactMount.registerContainer(container);
    instancesByReactRootID[reactRootID] = nextComponent;
    return reactRootID;
  },
  _renderNewRootComponent: ReactPerf.measure('ReactMount', '_renderNewRootComponent', function(nextComponent, container, shouldReuseMarkup) {
    var reactRootID = ReactMount._registerComponent(nextComponent, container);
    nextComponent.mountComponentIntoNode(reactRootID, container, shouldReuseMarkup);
    if ("production" !== process.env.NODE_ENV) {
      rootElementsByReactRootID[reactRootID] = getReactRootElementInContainer(container);
    }
    return nextComponent;
  }),
  renderComponent: function(nextComponent, container, callback) {
    var prevComponent = instancesByReactRootID[getReactRootID(container)];
    if (prevComponent) {
      if (shouldUpdateReactComponent(prevComponent, nextComponent)) {
        return ReactMount._updateRootComponent(prevComponent, nextComponent, container, callback);
      } else {
        ReactMount.unmountComponentAtNode(container);
      }
    }
    var reactRootElement = getReactRootElementInContainer(container);
    var containerHasReactMarkup = reactRootElement && ReactMount.isRenderedByReact(reactRootElement);
    var shouldReuseMarkup = containerHasReactMarkup && !prevComponent;
    var component = ReactMount._renderNewRootComponent(nextComponent, container, shouldReuseMarkup);
    callback && callback.call(component);
    return component;
  },
  constructAndRenderComponent: function(constructor, props, container) {
    return ReactMount.renderComponent(constructor(props), container);
  },
  constructAndRenderComponentByID: function(constructor, props, id) {
    var domNode = document.getElementById(id);
    ("production" !== process.env.NODE_ENV ? invariant(domNode, 'Tried to get element with id of "%s" but it is not present on the page.', id) : invariant(domNode));
    return ReactMount.constructAndRenderComponent(constructor, props, domNode);
  },
  registerContainer: function(container) {
    var reactRootID = getReactRootID(container);
    if (reactRootID) {
      reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(reactRootID);
    }
    if (!reactRootID) {
      reactRootID = ReactInstanceHandles.createReactRootID();
    }
    containersByReactRootID[reactRootID] = container;
    return reactRootID;
  },
  unmountComponentAtNode: function(container) {
    var reactRootID = getReactRootID(container);
    var component = instancesByReactRootID[reactRootID];
    if (!component) {
      return false;
    }
    ReactMount.unmountComponentFromNode(component, container);
    delete instancesByReactRootID[reactRootID];
    delete containersByReactRootID[reactRootID];
    if ("production" !== process.env.NODE_ENV) {
      delete rootElementsByReactRootID[reactRootID];
    }
    return true;
  },
  unmountComponentFromNode: function(instance, container) {
    instance.unmountComponent();
    if (container.nodeType === DOC_NODE_TYPE) {
      container = container.documentElement;
    }
    while (container.lastChild) {
      container.removeChild(container.lastChild);
    }
  },
  findReactContainerForID: function(id) {
    var reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(id);
    var container = containersByReactRootID[reactRootID];
    if ("production" !== process.env.NODE_ENV) {
      var rootElement = rootElementsByReactRootID[reactRootID];
      if (rootElement && rootElement.parentNode !== container) {
        ("production" !== process.env.NODE_ENV ? invariant(internalGetID(rootElement) === reactRootID, 'ReactMount: Root element ID differed from reactRootID.') : invariant(internalGetID(rootElement) === reactRootID));
        var containerChild = container.firstChild;
        if (containerChild && reactRootID === internalGetID(containerChild)) {
          rootElementsByReactRootID[reactRootID] = containerChild;
        } else {
          console.warn('ReactMount: Root element has been removed from its original ' + 'container. New container:', rootElement.parentNode);
        }
      }
    }
    return container;
  },
  findReactNodeByID: function(id) {
    var reactRoot = ReactMount.findReactContainerForID(id);
    return ReactMount.findComponentRoot(reactRoot, id);
  },
  isRenderedByReact: function(node) {
    if (node.nodeType !== 1) {
      return false;
    }
    var id = ReactMount.getID(node);
    return id ? id.charAt(0) === SEPARATOR : false;
  },
  getFirstReactDOM: function(node) {
    var current = node;
    while (current && current.parentNode !== current) {
      if (ReactMount.isRenderedByReact(current)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  },
  findComponentRoot: function(ancestorNode, targetID) {
    var firstChildren = findComponentRootReusableArray;
    var childIndex = 0;
    var deepestAncestor = findDeepestCachedAncestor(targetID) || ancestorNode;
    firstChildren[0] = deepestAncestor.firstChild;
    firstChildren.length = 1;
    while (childIndex < firstChildren.length) {
      var child = firstChildren[childIndex++];
      var targetChild;
      while (child) {
        var childID = ReactMount.getID(child);
        if (childID) {
          if (targetID === childID) {
            targetChild = child;
          } else if (ReactInstanceHandles.isAncestorIDOf(childID, targetID)) {
            firstChildren.length = childIndex = 0;
            firstChildren.push(child.firstChild);
          }
        } else {
          firstChildren.push(child.firstChild);
        }
        child = child.nextSibling;
      }
      if (targetChild) {
        firstChildren.length = 0;
        return targetChild;
      }
    }
    firstChildren.length = 0;
    ("production" !== process.env.NODE_ENV ? invariant(false, 'findComponentRoot(..., %s): Unable to find element. This probably ' + 'means the DOM was unexpectedly mutated (e.g., by the browser). ' + 'Try inspecting the child nodes of the element with React ID `%s`.', targetID, ReactMount.getID(ancestorNode)) : invariant(false));
  },
  getReactRootID: getReactRootID,
  getID: getID,
  setID: setID,
  getNode: getNode,
  purgeID: purgeID
};
module.exports = ReactMount;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./DOMProperty":22,"./ReactEventEmitter":62,"./ReactInstanceHandles":67,"./ReactPerf":74,"./containsNode":102,"./getReactRootElementInContainer":118,"./invariant":122,"./shouldUpdateReactComponent":140,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],70:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactMountReady";
"use strict";
var PooledClass = require("./PooledClass");
var mixInto = require("./mixInto");
function ReactMountReady(initialCollection) {
  this._queue = initialCollection || null;
}
mixInto(ReactMountReady, {
  enqueue: function(component, callback) {
    this._queue = this._queue || [];
    this._queue.push({
      component: component,
      callback: callback
    });
  },
  notifyAll: function() {
    var queue = this._queue;
    if (queue) {
      this._queue = null;
      for (var i = 0,
          l = queue.length; i < l; i++) {
        var component = queue[i].component;
        var callback = queue[i].callback;
        callback.call(component);
      }
      queue.length = 0;
    }
  },
  reset: function() {
    this._queue = null;
  },
  destructor: function() {
    this.reset();
  }
});
PooledClass.addPoolingTo(ReactMountReady);
module.exports = ReactMountReady;


},{"./PooledClass":37,"./mixInto":134}],71:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactMultiChild";
"use strict";
var ReactComponent = require("./ReactComponent");
var ReactMultiChildUpdateTypes = require("./ReactMultiChildUpdateTypes");
var flattenChildren = require("./flattenChildren");
var shouldUpdateReactComponent = require("./shouldUpdateReactComponent");
var updateDepth = 0;
var updateQueue = [];
var markupQueue = [];
function enqueueMarkup(parentID, markup, toIndex) {
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.INSERT_MARKUP,
    markupIndex: markupQueue.push(markup) - 1,
    textContent: null,
    fromIndex: null,
    toIndex: toIndex
  });
}
function enqueueMove(parentID, fromIndex, toIndex) {
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.MOVE_EXISTING,
    markupIndex: null,
    textContent: null,
    fromIndex: fromIndex,
    toIndex: toIndex
  });
}
function enqueueRemove(parentID, fromIndex) {
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.REMOVE_NODE,
    markupIndex: null,
    textContent: null,
    fromIndex: fromIndex,
    toIndex: null
  });
}
function enqueueTextContent(parentID, textContent) {
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.TEXT_CONTENT,
    markupIndex: null,
    textContent: textContent,
    fromIndex: null,
    toIndex: null
  });
}
function processQueue() {
  if (updateQueue.length) {
    ReactComponent.BackendIDOperations.dangerouslyProcessChildrenUpdates(updateQueue, markupQueue);
    clearQueue();
  }
}
function clearQueue() {
  updateQueue.length = 0;
  markupQueue.length = 0;
}
var ReactMultiChild = {Mixin: {
    mountChildren: function(nestedChildren, transaction) {
      var children = flattenChildren(nestedChildren);
      var mountImages = [];
      var index = 0;
      this._renderedChildren = children;
      for (var name in children) {
        var child = children[name];
        if (children.hasOwnProperty(name)) {
          var rootID = this._rootNodeID + name;
          var mountImage = child.mountComponent(rootID, transaction, this._mountDepth + 1);
          child._mountIndex = index;
          mountImages.push(mountImage);
          index++;
        }
      }
      return mountImages;
    },
    updateTextContent: function(nextContent) {
      updateDepth++;
      var errorThrown = true;
      try {
        var prevChildren = this._renderedChildren;
        for (var name in prevChildren) {
          if (prevChildren.hasOwnProperty(name)) {
            this._unmountChildByName(prevChildren[name], name);
          }
        }
        this.setTextContent(nextContent);
        errorThrown = false;
      } finally {
        updateDepth--;
        if (!updateDepth) {
          errorThrown ? clearQueue() : processQueue();
        }
      }
    },
    updateChildren: function(nextNestedChildren, transaction) {
      updateDepth++;
      var errorThrown = true;
      try {
        this._updateChildren(nextNestedChildren, transaction);
        errorThrown = false;
      } finally {
        updateDepth--;
        if (!updateDepth) {
          errorThrown ? clearQueue() : processQueue();
        }
      }
    },
    _updateChildren: function(nextNestedChildren, transaction) {
      var nextChildren = flattenChildren(nextNestedChildren);
      var prevChildren = this._renderedChildren;
      if (!nextChildren && !prevChildren) {
        return;
      }
      var name;
      var lastIndex = 0;
      var nextIndex = 0;
      for (name in nextChildren) {
        if (!nextChildren.hasOwnProperty(name)) {
          continue;
        }
        var prevChild = prevChildren && prevChildren[name];
        var nextChild = nextChildren[name];
        if (shouldUpdateReactComponent(prevChild, nextChild)) {
          this.moveChild(prevChild, nextIndex, lastIndex);
          lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          prevChild.receiveComponent(nextChild, transaction);
          prevChild._mountIndex = nextIndex;
        } else {
          if (prevChild) {
            lastIndex = Math.max(prevChild._mountIndex, lastIndex);
            this._unmountChildByName(prevChild, name);
          }
          this._mountChildByNameAtIndex(nextChild, name, nextIndex, transaction);
        }
        nextIndex++;
      }
      for (name in prevChildren) {
        if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren[name])) {
          this._unmountChildByName(prevChildren[name], name);
        }
      }
    },
    unmountChildren: function() {
      var renderedChildren = this._renderedChildren;
      for (var name in renderedChildren) {
        var renderedChild = renderedChildren[name];
        if (renderedChild.unmountComponent) {
          renderedChild.unmountComponent();
        }
      }
      this._renderedChildren = null;
    },
    moveChild: function(child, toIndex, lastIndex) {
      if (child._mountIndex < lastIndex) {
        enqueueMove(this._rootNodeID, child._mountIndex, toIndex);
      }
    },
    createChild: function(child, mountImage) {
      enqueueMarkup(this._rootNodeID, mountImage, child._mountIndex);
    },
    removeChild: function(child) {
      enqueueRemove(this._rootNodeID, child._mountIndex);
    },
    setTextContent: function(textContent) {
      enqueueTextContent(this._rootNodeID, textContent);
    },
    _mountChildByNameAtIndex: function(child, name, index, transaction) {
      var rootID = this._rootNodeID + name;
      var mountImage = child.mountComponent(rootID, transaction, this._mountDepth + 1);
      child._mountIndex = index;
      this.createChild(child, mountImage);
      this._renderedChildren = this._renderedChildren || {};
      this._renderedChildren[name] = child;
    },
    _unmountChildByName: function(child, name) {
      if (ReactComponent.isValidComponent(child)) {
        this.removeChild(child);
        child._mountIndex = null;
        child.unmountComponent();
        delete this._renderedChildren[name];
      }
    }
  }};
module.exports = ReactMultiChild;


},{"./ReactComponent":40,"./ReactMultiChildUpdateTypes":72,"./flattenChildren":111,"./shouldUpdateReactComponent":140}],72:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactMultiChildUpdateTypes";
"use strict";
var keyMirror = require("./keyMirror");
var ReactMultiChildUpdateTypes = keyMirror({
  INSERT_MARKUP: null,
  MOVE_EXISTING: null,
  REMOVE_NODE: null,
  TEXT_CONTENT: null
});
module.exports = ReactMultiChildUpdateTypes;


},{"./keyMirror":128}],73:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactOwner";
"use strict";
var invariant = require("./invariant");
var ReactOwner = {
  isValidOwner: function(object) {
    return !!(object && typeof object.attachRef === 'function' && typeof object.detachRef === 'function');
  },
  addComponentAsRefTo: function(component, ref, owner) {
    ("production" !== process.env.NODE_ENV ? invariant(ReactOwner.isValidOwner(owner), 'addComponentAsRefTo(...): Only a ReactOwner can have refs. This ' + 'usually means that you\'re trying to add a ref to a component that ' + 'doesn\'t have an owner (that is, was not created inside of another ' + 'component\'s `render` method). Try rendering this component inside of ' + 'a new top-level component which will hold the ref.') : invariant(ReactOwner.isValidOwner(owner)));
    owner.attachRef(ref, component);
  },
  removeComponentAsRefFrom: function(component, ref, owner) {
    ("production" !== process.env.NODE_ENV ? invariant(ReactOwner.isValidOwner(owner), 'removeComponentAsRefFrom(...): Only a ReactOwner can have refs. This ' + 'usually means that you\'re trying to remove a ref to a component that ' + 'doesn\'t have an owner (that is, was not created inside of another ' + 'component\'s `render` method). Try rendering this component inside of ' + 'a new top-level component which will hold the ref.') : invariant(ReactOwner.isValidOwner(owner)));
    if (owner.refs[ref] === component) {
      owner.detachRef(ref);
    }
  },
  Mixin: {
    attachRef: function(ref, component) {
      ("production" !== process.env.NODE_ENV ? invariant(component.isOwnedBy(this), 'attachRef(%s, ...): Only a component\'s owner can store a ref to it.', ref) : invariant(component.isOwnedBy(this)));
      var refs = this.refs || (this.refs = {});
      refs[ref] = component;
    },
    detachRef: function(ref) {
      delete this.refs[ref];
    }
  }
};
module.exports = ReactOwner;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],74:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactPerf";
"use strict";
var ReactPerf = {
  enableMeasure: false,
  storedMeasure: _noMeasure,
  measure: function(objName, fnName, func) {
    if ("production" !== process.env.NODE_ENV) {
      var measuredFunc = null;
      return function() {
        if (ReactPerf.enableMeasure) {
          if (!measuredFunc) {
            measuredFunc = ReactPerf.storedMeasure(objName, fnName, func);
          }
          return measuredFunc.apply(this, arguments);
        }
        return func.apply(this, arguments);
      };
    }
    return func;
  },
  injection: {injectMeasure: function(measure) {
      ReactPerf.storedMeasure = measure;
    }}
};
function _noMeasure(objName, fnName, func) {
  return func;
}
module.exports = ReactPerf;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],75:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactPropTransferer";
"use strict";
var emptyFunction = require("./emptyFunction");
var invariant = require("./invariant");
var joinClasses = require("./joinClasses");
var merge = require("./merge");
function createTransferStrategy(mergeStrategy) {
  return function(props, key, value) {
    if (!props.hasOwnProperty(key)) {
      props[key] = value;
    } else {
      props[key] = mergeStrategy(props[key], value);
    }
  };
}
var TransferStrategies = {
  children: emptyFunction,
  className: createTransferStrategy(joinClasses),
  key: emptyFunction,
  ref: emptyFunction,
  style: createTransferStrategy(merge)
};
var ReactPropTransferer = {
  TransferStrategies: TransferStrategies,
  mergeProps: function(oldProps, newProps) {
    var props = merge(oldProps);
    for (var thisKey in newProps) {
      if (!newProps.hasOwnProperty(thisKey)) {
        continue;
      }
      var transferStrategy = TransferStrategies[thisKey];
      if (transferStrategy) {
        transferStrategy(props, thisKey, newProps[thisKey]);
      } else if (!props.hasOwnProperty(thisKey)) {
        props[thisKey] = newProps[thisKey];
      }
    }
    return props;
  },
  Mixin: {transferPropsTo: function(component) {
      ("production" !== process.env.NODE_ENV ? invariant(component._owner === this, '%s: You can\'t call transferPropsTo() on a component that you ' + 'don\'t own, %s. This usually means you are calling ' + 'transferPropsTo() on a component passed in as props or children.', this.constructor.displayName, component.constructor.displayName) : invariant(component._owner === this));
      component.props = ReactPropTransferer.mergeProps(component.props, this.props);
      return component;
    }}
};
module.exports = ReactPropTransferer;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./emptyFunction":109,"./invariant":122,"./joinClasses":127,"./merge":131,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],76:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactPropTypeLocationNames";
"use strict";
var ReactPropTypeLocationNames = {};
if ("production" !== process.env.NODE_ENV) {
  ReactPropTypeLocationNames = {
    prop: 'prop',
    context: 'context',
    childContext: 'child context'
  };
}
module.exports = ReactPropTypeLocationNames;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],77:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactPropTypeLocations";
"use strict";
var keyMirror = require("./keyMirror");
var ReactPropTypeLocations = keyMirror({
  prop: null,
  context: null,
  childContext: null
});
module.exports = ReactPropTypeLocations;


},{"./keyMirror":128}],78:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactPropTypes";
"use strict";
var ReactComponent = require("./ReactComponent");
var ReactPropTypeLocationNames = require("./ReactPropTypeLocationNames");
var warning = require("./warning");
var createObjectFrom = require("./createObjectFrom");
var Props = {
  array: createPrimitiveTypeChecker('array'),
  bool: createPrimitiveTypeChecker('boolean'),
  func: createPrimitiveTypeChecker('function'),
  number: createPrimitiveTypeChecker('number'),
  object: createPrimitiveTypeChecker('object'),
  string: createPrimitiveTypeChecker('string'),
  shape: createShapeTypeChecker,
  oneOf: createEnumTypeChecker,
  oneOfType: createUnionTypeChecker,
  arrayOf: createArrayOfTypeChecker,
  instanceOf: createInstanceTypeChecker,
  renderable: createRenderableTypeChecker(),
  component: createComponentTypeChecker(),
  any: createAnyTypeChecker()
};
var ANONYMOUS = '<<anonymous>>';
function isRenderable(propValue) {
  switch (typeof propValue) {
    case 'number':
    case 'string':
      return true;
    case 'object':
      if (Array.isArray(propValue)) {
        return propValue.every(isRenderable);
      }
      if (ReactComponent.isValidComponent(propValue)) {
        return true;
      }
      for (var k in propValue) {
        if (!isRenderable(propValue[k])) {
          return false;
        }
      }
      return true;
    default:
      return false;
  }
}
function getPropType(propValue) {
  var propType = typeof propValue;
  if (propType === 'object' && Array.isArray(propValue)) {
    return 'array';
  }
  return propType;
}
function createAnyTypeChecker() {
  function validateAnyType(shouldWarn, propValue, propName, componentName, location) {
    return true;
  }
  return createChainableTypeChecker(validateAnyType);
}
function createPrimitiveTypeChecker(expectedType) {
  function validatePrimitiveType(shouldWarn, propValue, propName, componentName, location) {
    var propType = getPropType(propValue);
    var isValid = propType === expectedType;
    if (shouldWarn) {
      ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` of type `%s` supplied to `%s`, expected `%s`.', ReactPropTypeLocationNames[location], propName, propType, componentName, expectedType) : null);
    }
    return isValid;
  }
  return createChainableTypeChecker(validatePrimitiveType);
}
function createEnumTypeChecker(expectedValues) {
  var expectedEnum = createObjectFrom(expectedValues);
  function validateEnumType(shouldWarn, propValue, propName, componentName, location) {
    var isValid = expectedEnum[propValue];
    if (shouldWarn) {
      ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` supplied to `%s`, expected one of %s.', ReactPropTypeLocationNames[location], propName, componentName, JSON.stringify(Object.keys(expectedEnum))) : null);
    }
    return isValid;
  }
  return createChainableTypeChecker(validateEnumType);
}
function createShapeTypeChecker(shapeTypes) {
  function validateShapeType(shouldWarn, propValue, propName, componentName, location) {
    var propType = getPropType(propValue);
    var isValid = propType === 'object';
    if (isValid) {
      for (var key in shapeTypes) {
        var checker = shapeTypes[key];
        if (checker && !checker(propValue, key, componentName, location)) {
          return false;
        }
      }
    }
    if (shouldWarn) {
      ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` of type `%s` supplied to `%s`, expected `object`.', ReactPropTypeLocationNames[location], propName, propType, componentName) : null);
    }
    return isValid;
  }
  return createChainableTypeChecker(validateShapeType);
}
function createInstanceTypeChecker(expectedClass) {
  function validateInstanceType(shouldWarn, propValue, propName, componentName, location) {
    var isValid = propValue instanceof expectedClass;
    if (shouldWarn) {
      ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` supplied to `%s`, expected instance of `%s`.', ReactPropTypeLocationNames[location], propName, componentName, expectedClass.name || ANONYMOUS) : null);
    }
    return isValid;
  }
  return createChainableTypeChecker(validateInstanceType);
}
function createArrayOfTypeChecker(propTypeChecker) {
  function validateArrayType(shouldWarn, propValue, propName, componentName, location) {
    var isValid = Array.isArray(propValue);
    if (isValid) {
      for (var i = 0; i < propValue.length; i++) {
        if (!propTypeChecker(propValue, i, componentName, location)) {
          return false;
        }
      }
    }
    if (shouldWarn) {
      ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` supplied to `%s`, expected an array.', ReactPropTypeLocationNames[location], propName, componentName) : null);
    }
    return isValid;
  }
  return createChainableTypeChecker(validateArrayType);
}
function createRenderableTypeChecker() {
  function validateRenderableType(shouldWarn, propValue, propName, componentName, location) {
    var isValid = isRenderable(propValue);
    if (shouldWarn) {
      ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` supplied to `%s`, expected a renderable prop.', ReactPropTypeLocationNames[location], propName, componentName) : null);
    }
    return isValid;
  }
  return createChainableTypeChecker(validateRenderableType);
}
function createComponentTypeChecker() {
  function validateComponentType(shouldWarn, propValue, propName, componentName, location) {
    var isValid = ReactComponent.isValidComponent(propValue);
    if (shouldWarn) {
      ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` supplied to `%s`, expected a React component.', ReactPropTypeLocationNames[location], propName, componentName) : null);
    }
    return isValid;
  }
  return createChainableTypeChecker(validateComponentType);
}
function createUnionTypeChecker(arrayOfValidators) {
  return function(props, propName, componentName, location) {
    var isValid = false;
    for (var ii = 0; ii < arrayOfValidators.length; ii++) {
      var validate = arrayOfValidators[ii];
      if (typeof validate.weak === 'function') {
        validate = validate.weak;
      }
      if (validate(props, propName, componentName, location)) {
        isValid = true;
        break;
      }
    }
    ("production" !== process.env.NODE_ENV ? warning(isValid, 'Invalid %s `%s` supplied to `%s`.', ReactPropTypeLocationNames[location], propName, componentName || ANONYMOUS) : null);
    return isValid;
  };
}
function createChainableTypeChecker(validate) {
  function checkType(isRequired, shouldWarn, props, propName, componentName, location) {
    var propValue = props[propName];
    if (propValue != null) {
      return validate(shouldWarn, propValue, propName, componentName || ANONYMOUS, location);
    } else {
      var isValid = !isRequired;
      if (shouldWarn) {
        ("production" !== process.env.NODE_ENV ? warning(isValid, 'Required %s `%s` was not specified in `%s`.', ReactPropTypeLocationNames[location], propName, componentName || ANONYMOUS) : null);
      }
      return isValid;
    }
  }
  var checker = checkType.bind(null, false, true);
  checker.weak = checkType.bind(null, false, false);
  checker.isRequired = checkType.bind(null, true, true);
  checker.weak.isRequired = checkType.bind(null, true, false);
  checker.isRequired.weak = checker.weak.isRequired;
  return checker;
}
module.exports = Props;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactComponent":40,"./ReactPropTypeLocationNames":76,"./createObjectFrom":107,"./warning":143,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],79:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactPutListenerQueue";
"use strict";
var PooledClass = require("./PooledClass");
var ReactEventEmitter = require("./ReactEventEmitter");
var mixInto = require("./mixInto");
function ReactPutListenerQueue() {
  this.listenersToPut = [];
}
mixInto(ReactPutListenerQueue, {
  enqueuePutListener: function(rootNodeID, propKey, propValue) {
    this.listenersToPut.push({
      rootNodeID: rootNodeID,
      propKey: propKey,
      propValue: propValue
    });
  },
  putListeners: function() {
    for (var i = 0; i < this.listenersToPut.length; i++) {
      var listenerToPut = this.listenersToPut[i];
      ReactEventEmitter.putListener(listenerToPut.rootNodeID, listenerToPut.propKey, listenerToPut.propValue);
    }
  },
  reset: function() {
    this.listenersToPut.length = 0;
  },
  destructor: function() {
    this.reset();
  }
});
PooledClass.addPoolingTo(ReactPutListenerQueue);
module.exports = ReactPutListenerQueue;


},{"./PooledClass":37,"./ReactEventEmitter":62,"./mixInto":134}],80:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactReconcileTransaction";
"use strict";
var ExecutionEnvironment = require("./ExecutionEnvironment");
var PooledClass = require("./PooledClass");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactInputSelection = require("./ReactInputSelection");
var ReactMountReady = require("./ReactMountReady");
var ReactPutListenerQueue = require("./ReactPutListenerQueue");
var Transaction = require("./Transaction");
var mixInto = require("./mixInto");
var SELECTION_RESTORATION = {
  initialize: ReactInputSelection.getSelectionInformation,
  close: ReactInputSelection.restoreSelection
};
var EVENT_SUPPRESSION = {
  initialize: function() {
    var currentlyEnabled = ReactEventEmitter.isEnabled();
    ReactEventEmitter.setEnabled(false);
    return currentlyEnabled;
  },
  close: function(previouslyEnabled) {
    ReactEventEmitter.setEnabled(previouslyEnabled);
  }
};
var ON_DOM_READY_QUEUEING = {
  initialize: function() {
    this.reactMountReady.reset();
  },
  close: function() {
    this.reactMountReady.notifyAll();
  }
};
var PUT_LISTENER_QUEUEING = {
  initialize: function() {
    this.putListenerQueue.reset();
  },
  close: function() {
    this.putListenerQueue.putListeners();
  }
};
var TRANSACTION_WRAPPERS = [PUT_LISTENER_QUEUEING, SELECTION_RESTORATION, EVENT_SUPPRESSION, ON_DOM_READY_QUEUEING];
function ReactReconcileTransaction() {
  this.reinitializeTransaction();
  this.reactMountReady = ReactMountReady.getPooled(null);
  this.putListenerQueue = ReactPutListenerQueue.getPooled();
}
var Mixin = {
  getTransactionWrappers: function() {
    if (ExecutionEnvironment.canUseDOM) {
      return TRANSACTION_WRAPPERS;
    } else {
      return [];
    }
  },
  getReactMountReady: function() {
    return this.reactMountReady;
  },
  getPutListenerQueue: function() {
    return this.putListenerQueue;
  },
  destructor: function() {
    ReactMountReady.release(this.reactMountReady);
    this.reactMountReady = null;
    ReactPutListenerQueue.release(this.putListenerQueue);
    this.putListenerQueue = null;
  }
};
mixInto(ReactReconcileTransaction, Transaction.Mixin);
mixInto(ReactReconcileTransaction, Mixin);
PooledClass.addPoolingTo(ReactReconcileTransaction);
module.exports = ReactReconcileTransaction;


},{"./ExecutionEnvironment":34,"./PooledClass":37,"./ReactEventEmitter":62,"./ReactInputSelection":66,"./ReactMountReady":70,"./ReactPutListenerQueue":79,"./Transaction":98,"./mixInto":134}],81:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactRootIndex";
"use strict";
var ReactRootIndexInjection = {injectCreateReactRootIndex: function(_createReactRootIndex) {
    ReactRootIndex.createReactRootIndex = _createReactRootIndex;
  }};
var ReactRootIndex = {
  createReactRootIndex: null,
  injection: ReactRootIndexInjection
};
module.exports = ReactRootIndex;


},{}],82:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactServerRendering";
"use strict";
var ReactComponent = require("./ReactComponent");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactMarkupChecksum = require("./ReactMarkupChecksum");
var ReactReconcileTransaction = require("./ReactReconcileTransaction");
var invariant = require("./invariant");
function renderComponentToString(component) {
  ("production" !== process.env.NODE_ENV ? invariant(ReactComponent.isValidComponent(component), 'renderComponentToString(): You must pass a valid ReactComponent.') : invariant(ReactComponent.isValidComponent(component)));
  ("production" !== process.env.NODE_ENV ? invariant(!(arguments.length === 2 && typeof arguments[1] === 'function'), 'renderComponentToString(): This function became synchronous and now ' + 'returns the generated markup. Please remove the second parameter.') : invariant(!(arguments.length === 2 && typeof arguments[1] === 'function')));
  var id = ReactInstanceHandles.createReactRootID();
  var transaction = ReactReconcileTransaction.getPooled();
  transaction.reinitializeTransaction();
  try {
    return transaction.perform(function() {
      var markup = component.mountComponent(id, transaction, 0);
      return ReactMarkupChecksum.addChecksumToMarkup(markup);
    }, null);
  } finally {
    ReactReconcileTransaction.release(transaction);
  }
}
module.exports = {renderComponentToString: renderComponentToString};


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactComponent":40,"./ReactInstanceHandles":67,"./ReactMarkupChecksum":68,"./ReactReconcileTransaction":80,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],83:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ReactTextComponent";
"use strict";
var DOMPropertyOperations = require("./DOMPropertyOperations");
var ReactComponent = require("./ReactComponent");
var escapeTextForBrowser = require("./escapeTextForBrowser");
var mixInto = require("./mixInto");
var ReactTextComponent = function(initialText) {
  this.construct({text: initialText});
};
mixInto(ReactTextComponent, ReactComponent.Mixin);
mixInto(ReactTextComponent, {
  mountComponent: function(rootID, transaction, mountDepth) {
    ReactComponent.Mixin.mountComponent.call(this, rootID, transaction, mountDepth);
    return ('<span ' + DOMPropertyOperations.createMarkupForID(rootID) + '>' + escapeTextForBrowser(this.props.text) + '</span>');
  },
  receiveComponent: function(nextComponent, transaction) {
    var nextProps = nextComponent.props;
    if (nextProps.text !== this.props.text) {
      this.props.text = nextProps.text;
      ReactComponent.BackendIDOperations.updateTextContentByID(this._rootNodeID, nextProps.text);
    }
  }
});
ReactTextComponent.type = ReactTextComponent;
ReactTextComponent.prototype.type = ReactTextComponent;
module.exports = ReactTextComponent;


},{"./DOMPropertyOperations":23,"./ReactComponent":40,"./escapeTextForBrowser":110,"./mixInto":134}],84:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/ReactUpdates";
"use strict";
var ReactPerf = require("./ReactPerf");
var invariant = require("./invariant");
var dirtyComponents = [];
var batchingStrategy = null;
function ensureBatchingStrategy() {
  ("production" !== process.env.NODE_ENV ? invariant(batchingStrategy, 'ReactUpdates: must inject a batching strategy') : invariant(batchingStrategy));
}
function batchedUpdates(callback, param) {
  ensureBatchingStrategy();
  batchingStrategy.batchedUpdates(callback, param);
}
function mountDepthComparator(c1, c2) {
  return c1._mountDepth - c2._mountDepth;
}
function runBatchedUpdates() {
  dirtyComponents.sort(mountDepthComparator);
  for (var i = 0; i < dirtyComponents.length; i++) {
    var component = dirtyComponents[i];
    if (component.isMounted()) {
      var callbacks = component._pendingCallbacks;
      component._pendingCallbacks = null;
      component.performUpdateIfNecessary();
      if (callbacks) {
        for (var j = 0; j < callbacks.length; j++) {
          callbacks[j].call(component);
        }
      }
    }
  }
}
function clearDirtyComponents() {
  dirtyComponents.length = 0;
}
var flushBatchedUpdates = ReactPerf.measure('ReactUpdates', 'flushBatchedUpdates', function() {
  try {
    runBatchedUpdates();
  } finally {
    clearDirtyComponents();
  }
});
function enqueueUpdate(component, callback) {
  ("production" !== process.env.NODE_ENV ? invariant(!callback || typeof callback === "function", 'enqueueUpdate(...): You called `setProps`, `replaceProps`, ' + '`setState`, `replaceState`, or `forceUpdate` with a callback that ' + 'isn\'t callable.') : invariant(!callback || typeof callback === "function"));
  ensureBatchingStrategy();
  if (!batchingStrategy.isBatchingUpdates) {
    component.performUpdateIfNecessary();
    callback && callback.call(component);
    return;
  }
  dirtyComponents.push(component);
  if (callback) {
    if (component._pendingCallbacks) {
      component._pendingCallbacks.push(callback);
    } else {
      component._pendingCallbacks = [callback];
    }
  }
}
var ReactUpdatesInjection = {injectBatchingStrategy: function(_batchingStrategy) {
    ("production" !== process.env.NODE_ENV ? invariant(_batchingStrategy, 'ReactUpdates: must provide a batching strategy') : invariant(_batchingStrategy));
    ("production" !== process.env.NODE_ENV ? invariant(typeof _batchingStrategy.batchedUpdates === 'function', 'ReactUpdates: must provide a batchedUpdates() function') : invariant(typeof _batchingStrategy.batchedUpdates === 'function'));
    ("production" !== process.env.NODE_ENV ? invariant(typeof _batchingStrategy.isBatchingUpdates === 'boolean', 'ReactUpdates: must provide an isBatchingUpdates boolean attribute') : invariant(typeof _batchingStrategy.isBatchingUpdates === 'boolean'));
    batchingStrategy = _batchingStrategy;
  }};
var ReactUpdates = {
  batchedUpdates: batchedUpdates,
  enqueueUpdate: enqueueUpdate,
  flushBatchedUpdates: flushBatchedUpdates,
  injection: ReactUpdatesInjection
};
module.exports = ReactUpdates;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactPerf":74,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],85:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SelectEventPlugin";
"use strict";
var EventConstants = require("./EventConstants");
var EventPropagators = require("./EventPropagators");
var ReactInputSelection = require("./ReactInputSelection");
var SyntheticEvent = require("./SyntheticEvent");
var getActiveElement = require("./getActiveElement");
var isTextInputElement = require("./isTextInputElement");
var keyOf = require("./keyOf");
var shallowEqual = require("./shallowEqual");
var topLevelTypes = EventConstants.topLevelTypes;
var eventTypes = {select: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSelect: null}),
      captured: keyOf({onSelectCapture: null})
    },
    dependencies: [topLevelTypes.topBlur, topLevelTypes.topContextMenu, topLevelTypes.topFocus, topLevelTypes.topKeyDown, topLevelTypes.topMouseDown, topLevelTypes.topMouseUp, topLevelTypes.topSelectionChange]
  }};
var activeElement = null;
var activeElementID = null;
var lastSelection = null;
var mouseDown = false;
function getSelection(node) {
  if ('selectionStart' in node && ReactInputSelection.hasSelectionCapabilities(node)) {
    return {
      start: node.selectionStart,
      end: node.selectionEnd
    };
  } else if (document.selection) {
    var range = document.selection.createRange();
    return {
      parentElement: range.parentElement(),
      text: range.text,
      top: range.boundingTop,
      left: range.boundingLeft
    };
  } else {
    var selection = window.getSelection();
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset
    };
  }
}
function constructSelectEvent(nativeEvent) {
  if (mouseDown || activeElement == null || activeElement != getActiveElement()) {
    return;
  }
  var currentSelection = getSelection(activeElement);
  if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
    lastSelection = currentSelection;
    var syntheticEvent = SyntheticEvent.getPooled(eventTypes.select, activeElementID, nativeEvent);
    syntheticEvent.type = 'select';
    syntheticEvent.target = activeElement;
    EventPropagators.accumulateTwoPhaseDispatches(syntheticEvent);
    return syntheticEvent;
  }
}
var SelectEventPlugin = {
  eventTypes: eventTypes,
  extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    switch (topLevelType) {
      case topLevelTypes.topFocus:
        if (isTextInputElement(topLevelTarget) || topLevelTarget.contentEditable === 'true') {
          activeElement = topLevelTarget;
          activeElementID = topLevelTargetID;
          lastSelection = null;
        }
        break;
      case topLevelTypes.topBlur:
        activeElement = null;
        activeElementID = null;
        lastSelection = null;
        break;
      case topLevelTypes.topMouseDown:
        mouseDown = true;
        break;
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topMouseUp:
        mouseDown = false;
        return constructSelectEvent(nativeEvent);
      case topLevelTypes.topSelectionChange:
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyUp:
        return constructSelectEvent(nativeEvent);
    }
  }
};
module.exports = SelectEventPlugin;


},{"./EventConstants":28,"./EventPropagators":33,"./ReactInputSelection":66,"./SyntheticEvent":91,"./getActiveElement":113,"./isTextInputElement":125,"./keyOf":129,"./shallowEqual":139}],86:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ServerReactRootIndex";
"use strict";
var GLOBAL_MOUNT_POINT_MAX = Math.pow(2, 53);
var ServerReactRootIndex = {createReactRootIndex: function() {
    return Math.ceil(Math.random() * GLOBAL_MOUNT_POINT_MAX);
  }};
module.exports = ServerReactRootIndex;


},{}],87:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/SimpleEventPlugin";
"use strict";
var EventConstants = require("./EventConstants");
var EventPluginUtils = require("./EventPluginUtils");
var EventPropagators = require("./EventPropagators");
var SyntheticClipboardEvent = require("./SyntheticClipboardEvent");
var SyntheticEvent = require("./SyntheticEvent");
var SyntheticFocusEvent = require("./SyntheticFocusEvent");
var SyntheticKeyboardEvent = require("./SyntheticKeyboardEvent");
var SyntheticMouseEvent = require("./SyntheticMouseEvent");
var SyntheticDragEvent = require("./SyntheticDragEvent");
var SyntheticTouchEvent = require("./SyntheticTouchEvent");
var SyntheticUIEvent = require("./SyntheticUIEvent");
var SyntheticWheelEvent = require("./SyntheticWheelEvent");
var invariant = require("./invariant");
var keyOf = require("./keyOf");
var topLevelTypes = EventConstants.topLevelTypes;
var eventTypes = {
  blur: {phasedRegistrationNames: {
      bubbled: keyOf({onBlur: true}),
      captured: keyOf({onBlurCapture: true})
    }},
  click: {phasedRegistrationNames: {
      bubbled: keyOf({onClick: true}),
      captured: keyOf({onClickCapture: true})
    }},
  contextMenu: {phasedRegistrationNames: {
      bubbled: keyOf({onContextMenu: true}),
      captured: keyOf({onContextMenuCapture: true})
    }},
  copy: {phasedRegistrationNames: {
      bubbled: keyOf({onCopy: true}),
      captured: keyOf({onCopyCapture: true})
    }},
  cut: {phasedRegistrationNames: {
      bubbled: keyOf({onCut: true}),
      captured: keyOf({onCutCapture: true})
    }},
  doubleClick: {phasedRegistrationNames: {
      bubbled: keyOf({onDoubleClick: true}),
      captured: keyOf({onDoubleClickCapture: true})
    }},
  drag: {phasedRegistrationNames: {
      bubbled: keyOf({onDrag: true}),
      captured: keyOf({onDragCapture: true})
    }},
  dragEnd: {phasedRegistrationNames: {
      bubbled: keyOf({onDragEnd: true}),
      captured: keyOf({onDragEndCapture: true})
    }},
  dragEnter: {phasedRegistrationNames: {
      bubbled: keyOf({onDragEnter: true}),
      captured: keyOf({onDragEnterCapture: true})
    }},
  dragExit: {phasedRegistrationNames: {
      bubbled: keyOf({onDragExit: true}),
      captured: keyOf({onDragExitCapture: true})
    }},
  dragLeave: {phasedRegistrationNames: {
      bubbled: keyOf({onDragLeave: true}),
      captured: keyOf({onDragLeaveCapture: true})
    }},
  dragOver: {phasedRegistrationNames: {
      bubbled: keyOf({onDragOver: true}),
      captured: keyOf({onDragOverCapture: true})
    }},
  dragStart: {phasedRegistrationNames: {
      bubbled: keyOf({onDragStart: true}),
      captured: keyOf({onDragStartCapture: true})
    }},
  drop: {phasedRegistrationNames: {
      bubbled: keyOf({onDrop: true}),
      captured: keyOf({onDropCapture: true})
    }},
  focus: {phasedRegistrationNames: {
      bubbled: keyOf({onFocus: true}),
      captured: keyOf({onFocusCapture: true})
    }},
  input: {phasedRegistrationNames: {
      bubbled: keyOf({onInput: true}),
      captured: keyOf({onInputCapture: true})
    }},
  keyDown: {phasedRegistrationNames: {
      bubbled: keyOf({onKeyDown: true}),
      captured: keyOf({onKeyDownCapture: true})
    }},
  keyPress: {phasedRegistrationNames: {
      bubbled: keyOf({onKeyPress: true}),
      captured: keyOf({onKeyPressCapture: true})
    }},
  keyUp: {phasedRegistrationNames: {
      bubbled: keyOf({onKeyUp: true}),
      captured: keyOf({onKeyUpCapture: true})
    }},
  load: {phasedRegistrationNames: {
      bubbled: keyOf({onLoad: true}),
      captured: keyOf({onLoadCapture: true})
    }},
  error: {phasedRegistrationNames: {
      bubbled: keyOf({onError: true}),
      captured: keyOf({onErrorCapture: true})
    }},
  mouseDown: {phasedRegistrationNames: {
      bubbled: keyOf({onMouseDown: true}),
      captured: keyOf({onMouseDownCapture: true})
    }},
  mouseMove: {phasedRegistrationNames: {
      bubbled: keyOf({onMouseMove: true}),
      captured: keyOf({onMouseMoveCapture: true})
    }},
  mouseOut: {phasedRegistrationNames: {
      bubbled: keyOf({onMouseOut: true}),
      captured: keyOf({onMouseOutCapture: true})
    }},
  mouseOver: {phasedRegistrationNames: {
      bubbled: keyOf({onMouseOver: true}),
      captured: keyOf({onMouseOverCapture: true})
    }},
  mouseUp: {phasedRegistrationNames: {
      bubbled: keyOf({onMouseUp: true}),
      captured: keyOf({onMouseUpCapture: true})
    }},
  paste: {phasedRegistrationNames: {
      bubbled: keyOf({onPaste: true}),
      captured: keyOf({onPasteCapture: true})
    }},
  reset: {phasedRegistrationNames: {
      bubbled: keyOf({onReset: true}),
      captured: keyOf({onResetCapture: true})
    }},
  scroll: {phasedRegistrationNames: {
      bubbled: keyOf({onScroll: true}),
      captured: keyOf({onScrollCapture: true})
    }},
  submit: {phasedRegistrationNames: {
      bubbled: keyOf({onSubmit: true}),
      captured: keyOf({onSubmitCapture: true})
    }},
  touchCancel: {phasedRegistrationNames: {
      bubbled: keyOf({onTouchCancel: true}),
      captured: keyOf({onTouchCancelCapture: true})
    }},
  touchEnd: {phasedRegistrationNames: {
      bubbled: keyOf({onTouchEnd: true}),
      captured: keyOf({onTouchEndCapture: true})
    }},
  touchMove: {phasedRegistrationNames: {
      bubbled: keyOf({onTouchMove: true}),
      captured: keyOf({onTouchMoveCapture: true})
    }},
  touchStart: {phasedRegistrationNames: {
      bubbled: keyOf({onTouchStart: true}),
      captured: keyOf({onTouchStartCapture: true})
    }},
  wheel: {phasedRegistrationNames: {
      bubbled: keyOf({onWheel: true}),
      captured: keyOf({onWheelCapture: true})
    }}
};
var topLevelEventsToDispatchConfig = {
  topBlur: eventTypes.blur,
  topClick: eventTypes.click,
  topContextMenu: eventTypes.contextMenu,
  topCopy: eventTypes.copy,
  topCut: eventTypes.cut,
  topDoubleClick: eventTypes.doubleClick,
  topDrag: eventTypes.drag,
  topDragEnd: eventTypes.dragEnd,
  topDragEnter: eventTypes.dragEnter,
  topDragExit: eventTypes.dragExit,
  topDragLeave: eventTypes.dragLeave,
  topDragOver: eventTypes.dragOver,
  topDragStart: eventTypes.dragStart,
  topDrop: eventTypes.drop,
  topError: eventTypes.error,
  topFocus: eventTypes.focus,
  topInput: eventTypes.input,
  topKeyDown: eventTypes.keyDown,
  topKeyPress: eventTypes.keyPress,
  topKeyUp: eventTypes.keyUp,
  topLoad: eventTypes.load,
  topMouseDown: eventTypes.mouseDown,
  topMouseMove: eventTypes.mouseMove,
  topMouseOut: eventTypes.mouseOut,
  topMouseOver: eventTypes.mouseOver,
  topMouseUp: eventTypes.mouseUp,
  topPaste: eventTypes.paste,
  topReset: eventTypes.reset,
  topScroll: eventTypes.scroll,
  topSubmit: eventTypes.submit,
  topTouchCancel: eventTypes.touchCancel,
  topTouchEnd: eventTypes.touchEnd,
  topTouchMove: eventTypes.touchMove,
  topTouchStart: eventTypes.touchStart,
  topWheel: eventTypes.wheel
};
for (var topLevelType in topLevelEventsToDispatchConfig) {
  topLevelEventsToDispatchConfig[topLevelType].dependencies = [topLevelType];
}
var SimpleEventPlugin = {
  eventTypes: eventTypes,
  executeDispatch: function(event, listener, domID) {
    var returnValue = EventPluginUtils.executeDispatch(event, listener, domID);
    if (returnValue === false) {
      event.stopPropagation();
      event.preventDefault();
    }
  },
  extractEvents: function(topLevelType, topLevelTarget, topLevelTargetID, nativeEvent) {
    var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType];
    if (!dispatchConfig) {
      return null;
    }
    var EventConstructor;
    switch (topLevelType) {
      case topLevelTypes.topInput:
      case topLevelTypes.topLoad:
      case topLevelTypes.topError:
      case topLevelTypes.topReset:
      case topLevelTypes.topSubmit:
        EventConstructor = SyntheticEvent;
        break;
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyPress:
      case topLevelTypes.topKeyUp:
        EventConstructor = SyntheticKeyboardEvent;
        break;
      case topLevelTypes.topBlur:
      case topLevelTypes.topFocus:
        EventConstructor = SyntheticFocusEvent;
        break;
      case topLevelTypes.topClick:
        if (nativeEvent.button === 2) {
          return null;
        }
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topDoubleClick:
      case topLevelTypes.topMouseDown:
      case topLevelTypes.topMouseMove:
      case topLevelTypes.topMouseOut:
      case topLevelTypes.topMouseOver:
      case topLevelTypes.topMouseUp:
        EventConstructor = SyntheticMouseEvent;
        break;
      case topLevelTypes.topDrag:
      case topLevelTypes.topDragEnd:
      case topLevelTypes.topDragEnter:
      case topLevelTypes.topDragExit:
      case topLevelTypes.topDragLeave:
      case topLevelTypes.topDragOver:
      case topLevelTypes.topDragStart:
      case topLevelTypes.topDrop:
        EventConstructor = SyntheticDragEvent;
        break;
      case topLevelTypes.topTouchCancel:
      case topLevelTypes.topTouchEnd:
      case topLevelTypes.topTouchMove:
      case topLevelTypes.topTouchStart:
        EventConstructor = SyntheticTouchEvent;
        break;
      case topLevelTypes.topScroll:
        EventConstructor = SyntheticUIEvent;
        break;
      case topLevelTypes.topWheel:
        EventConstructor = SyntheticWheelEvent;
        break;
      case topLevelTypes.topCopy:
      case topLevelTypes.topCut:
      case topLevelTypes.topPaste:
        EventConstructor = SyntheticClipboardEvent;
        break;
    }
    ("production" !== process.env.NODE_ENV ? invariant(EventConstructor, 'SimpleEventPlugin: Unhandled event type, `%s`.', topLevelType) : invariant(EventConstructor));
    var event = EventConstructor.getPooled(dispatchConfig, topLevelTargetID, nativeEvent);
    EventPropagators.accumulateTwoPhaseDispatches(event);
    return event;
  }
};
module.exports = SimpleEventPlugin;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./EventConstants":28,"./EventPluginUtils":32,"./EventPropagators":33,"./SyntheticClipboardEvent":88,"./SyntheticDragEvent":90,"./SyntheticEvent":91,"./SyntheticFocusEvent":92,"./SyntheticKeyboardEvent":93,"./SyntheticMouseEvent":94,"./SyntheticTouchEvent":95,"./SyntheticUIEvent":96,"./SyntheticWheelEvent":97,"./invariant":122,"./keyOf":129,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],88:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticClipboardEvent";
"use strict";
var SyntheticEvent = require("./SyntheticEvent");
var ClipboardEventInterface = {clipboardData: function(event) {
    return ('clipboardData' in event ? event.clipboardData : window.clipboardData);
  }};
function SyntheticClipboardEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticEvent.augmentClass(SyntheticClipboardEvent, ClipboardEventInterface);
module.exports = SyntheticClipboardEvent;


},{"./SyntheticEvent":91}],89:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticCompositionEvent";
"use strict";
var SyntheticEvent = require("./SyntheticEvent");
var CompositionEventInterface = {data: null};
function SyntheticCompositionEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticEvent.augmentClass(SyntheticCompositionEvent, CompositionEventInterface);
module.exports = SyntheticCompositionEvent;


},{"./SyntheticEvent":91}],90:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticDragEvent";
"use strict";
var SyntheticMouseEvent = require("./SyntheticMouseEvent");
var DragEventInterface = {dataTransfer: null};
function SyntheticDragEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticMouseEvent.augmentClass(SyntheticDragEvent, DragEventInterface);
module.exports = SyntheticDragEvent;


},{"./SyntheticMouseEvent":94}],91:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticEvent";
"use strict";
var PooledClass = require("./PooledClass");
var emptyFunction = require("./emptyFunction");
var getEventTarget = require("./getEventTarget");
var merge = require("./merge");
var mergeInto = require("./mergeInto");
var EventInterface = {
  type: null,
  target: getEventTarget,
  currentTarget: emptyFunction.thatReturnsNull,
  eventPhase: null,
  bubbles: null,
  cancelable: null,
  timeStamp: function(event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: null,
  isTrusted: null
};
function SyntheticEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  this.dispatchConfig = dispatchConfig;
  this.dispatchMarker = dispatchMarker;
  this.nativeEvent = nativeEvent;
  var Interface = this.constructor.Interface;
  for (var propName in Interface) {
    if (!Interface.hasOwnProperty(propName)) {
      continue;
    }
    var normalize = Interface[propName];
    if (normalize) {
      this[propName] = normalize(nativeEvent);
    } else {
      this[propName] = nativeEvent[propName];
    }
  }
  var defaultPrevented = nativeEvent.defaultPrevented != null ? nativeEvent.defaultPrevented : nativeEvent.returnValue === false;
  if (defaultPrevented) {
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  } else {
    this.isDefaultPrevented = emptyFunction.thatReturnsFalse;
  }
  this.isPropagationStopped = emptyFunction.thatReturnsFalse;
}
mergeInto(SyntheticEvent.prototype, {
  preventDefault: function() {
    this.defaultPrevented = true;
    var event = this.nativeEvent;
    event.preventDefault ? event.preventDefault() : event.returnValue = false;
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  },
  stopPropagation: function() {
    var event = this.nativeEvent;
    event.stopPropagation ? event.stopPropagation() : event.cancelBubble = true;
    this.isPropagationStopped = emptyFunction.thatReturnsTrue;
  },
  persist: function() {
    this.isPersistent = emptyFunction.thatReturnsTrue;
  },
  isPersistent: emptyFunction.thatReturnsFalse,
  destructor: function() {
    var Interface = this.constructor.Interface;
    for (var propName in Interface) {
      this[propName] = null;
    }
    this.dispatchConfig = null;
    this.dispatchMarker = null;
    this.nativeEvent = null;
  }
});
SyntheticEvent.Interface = EventInterface;
SyntheticEvent.augmentClass = function(Class, Interface) {
  var Super = this;
  var prototype = Object.create(Super.prototype);
  mergeInto(prototype, Class.prototype);
  Class.prototype = prototype;
  Class.prototype.constructor = Class;
  Class.Interface = merge(Super.Interface, Interface);
  Class.augmentClass = Super.augmentClass;
  PooledClass.addPoolingTo(Class, PooledClass.threeArgumentPooler);
};
PooledClass.addPoolingTo(SyntheticEvent, PooledClass.threeArgumentPooler);
module.exports = SyntheticEvent;


},{"./PooledClass":37,"./emptyFunction":109,"./getEventTarget":115,"./merge":131,"./mergeInto":133}],92:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticFocusEvent";
"use strict";
var SyntheticUIEvent = require("./SyntheticUIEvent");
var FocusEventInterface = {relatedTarget: null};
function SyntheticFocusEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticUIEvent.augmentClass(SyntheticFocusEvent, FocusEventInterface);
module.exports = SyntheticFocusEvent;


},{"./SyntheticUIEvent":96}],93:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticKeyboardEvent";
"use strict";
var SyntheticUIEvent = require("./SyntheticUIEvent");
var getEventKey = require("./getEventKey");
var KeyboardEventInterface = {
  key: getEventKey,
  location: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  repeat: null,
  locale: null,
  'char': null,
  charCode: null,
  keyCode: null,
  which: null
};
function SyntheticKeyboardEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticUIEvent.augmentClass(SyntheticKeyboardEvent, KeyboardEventInterface);
module.exports = SyntheticKeyboardEvent;


},{"./SyntheticUIEvent":96,"./getEventKey":114}],94:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticMouseEvent";
"use strict";
var SyntheticUIEvent = require("./SyntheticUIEvent");
var ViewportMetrics = require("./ViewportMetrics");
var MouseEventInterface = {
  screenX: null,
  screenY: null,
  clientX: null,
  clientY: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  button: function(event) {
    var button = event.button;
    if ('which' in event) {
      return button;
    }
    return button === 2 ? 2 : button === 4 ? 1 : 0;
  },
  buttons: null,
  relatedTarget: function(event) {
    return event.relatedTarget || (event.fromElement === event.srcElement ? event.toElement : event.fromElement);
  },
  pageX: function(event) {
    return 'pageX' in event ? event.pageX : event.clientX + ViewportMetrics.currentScrollLeft;
  },
  pageY: function(event) {
    return 'pageY' in event ? event.pageY : event.clientY + ViewportMetrics.currentScrollTop;
  }
};
function SyntheticMouseEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticUIEvent.augmentClass(SyntheticMouseEvent, MouseEventInterface);
module.exports = SyntheticMouseEvent;


},{"./SyntheticUIEvent":96,"./ViewportMetrics":99}],95:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticTouchEvent";
"use strict";
var SyntheticUIEvent = require("./SyntheticUIEvent");
var TouchEventInterface = {
  touches: null,
  targetTouches: null,
  changedTouches: null,
  altKey: null,
  metaKey: null,
  ctrlKey: null,
  shiftKey: null
};
function SyntheticTouchEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticUIEvent.augmentClass(SyntheticTouchEvent, TouchEventInterface);
module.exports = SyntheticTouchEvent;


},{"./SyntheticUIEvent":96}],96:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticUIEvent";
"use strict";
var SyntheticEvent = require("./SyntheticEvent");
var UIEventInterface = {
  view: null,
  detail: null
};
function SyntheticUIEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticEvent.augmentClass(SyntheticUIEvent, UIEventInterface);
module.exports = SyntheticUIEvent;


},{"./SyntheticEvent":91}],97:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/SyntheticWheelEvent";
"use strict";
var SyntheticMouseEvent = require("./SyntheticMouseEvent");
var WheelEventInterface = {
  deltaX: function(event) {
    return ('deltaX' in event ? event.deltaX : 'wheelDeltaX' in event ? -event.wheelDeltaX : 0);
  },
  deltaY: function(event) {
    return ('deltaY' in event ? event.deltaY : 'wheelDeltaY' in event ? -event.wheelDeltaY : 'wheelDelta' in event ? -event.wheelDelta : 0);
  },
  deltaZ: null,
  deltaMode: null
};
function SyntheticWheelEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}
SyntheticMouseEvent.augmentClass(SyntheticWheelEvent, WheelEventInterface);
module.exports = SyntheticWheelEvent;


},{"./SyntheticMouseEvent":94}],98:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/Transaction";
"use strict";
var invariant = require("./invariant");
var Mixin = {
  reinitializeTransaction: function() {
    this.transactionWrappers = this.getTransactionWrappers();
    if (!this.wrapperInitData) {
      this.wrapperInitData = [];
    } else {
      this.wrapperInitData.length = 0;
    }
    if (!this.timingMetrics) {
      this.timingMetrics = {};
    }
    this.timingMetrics.methodInvocationTime = 0;
    if (!this.timingMetrics.wrapperInitTimes) {
      this.timingMetrics.wrapperInitTimes = [];
    } else {
      this.timingMetrics.wrapperInitTimes.length = 0;
    }
    if (!this.timingMetrics.wrapperCloseTimes) {
      this.timingMetrics.wrapperCloseTimes = [];
    } else {
      this.timingMetrics.wrapperCloseTimes.length = 0;
    }
    this._isInTransaction = false;
  },
  _isInTransaction: false,
  getTransactionWrappers: null,
  isInTransaction: function() {
    return !!this._isInTransaction;
  },
  perform: function(method, scope, a, b, c, d, e, f) {
    ("production" !== process.env.NODE_ENV ? invariant(!this.isInTransaction(), 'Transaction.perform(...): Cannot initialize a transaction when there ' + 'is already an outstanding transaction.') : invariant(!this.isInTransaction()));
    var memberStart = Date.now();
    var errorThrown;
    var ret;
    try {
      this._isInTransaction = true;
      errorThrown = true;
      this.initializeAll(0);
      ret = method.call(scope, a, b, c, d, e, f);
      errorThrown = false;
    } finally {
      var memberEnd = Date.now();
      this.methodInvocationTime += (memberEnd - memberStart);
      try {
        if (errorThrown) {
          try {
            this.closeAll(0);
          } catch (err) {}
        } else {
          this.closeAll(0);
        }
      } finally {
        this._isInTransaction = false;
      }
    }
    return ret;
  },
  initializeAll: function(startIndex) {
    var transactionWrappers = this.transactionWrappers;
    var wrapperInitTimes = this.timingMetrics.wrapperInitTimes;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var initStart = Date.now();
      var wrapper = transactionWrappers[i];
      try {
        this.wrapperInitData[i] = Transaction.OBSERVED_ERROR;
        this.wrapperInitData[i] = wrapper.initialize ? wrapper.initialize.call(this) : null;
      } finally {
        var curInitTime = wrapperInitTimes[i];
        var initEnd = Date.now();
        wrapperInitTimes[i] = (curInitTime || 0) + (initEnd - initStart);
        if (this.wrapperInitData[i] === Transaction.OBSERVED_ERROR) {
          try {
            this.initializeAll(i + 1);
          } catch (err) {}
        }
      }
    }
  },
  closeAll: function(startIndex) {
    ("production" !== process.env.NODE_ENV ? invariant(this.isInTransaction(), 'Transaction.closeAll(): Cannot close transaction when none are open.') : invariant(this.isInTransaction()));
    var transactionWrappers = this.transactionWrappers;
    var wrapperCloseTimes = this.timingMetrics.wrapperCloseTimes;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      var closeStart = Date.now();
      var initData = this.wrapperInitData[i];
      var errorThrown;
      try {
        errorThrown = true;
        if (initData !== Transaction.OBSERVED_ERROR) {
          wrapper.close && wrapper.close.call(this, initData);
        }
        errorThrown = false;
      } finally {
        var closeEnd = Date.now();
        var curCloseTime = wrapperCloseTimes[i];
        wrapperCloseTimes[i] = (curCloseTime || 0) + (closeEnd - closeStart);
        if (errorThrown) {
          try {
            this.closeAll(i + 1);
          } catch (e) {}
        }
      }
    }
    this.wrapperInitData.length = 0;
  }
};
var Transaction = {
  Mixin: Mixin,
  OBSERVED_ERROR: {}
};
module.exports = Transaction;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],99:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/ViewportMetrics";
"use strict";
var getUnboundedScrollPosition = require("./getUnboundedScrollPosition");
var ViewportMetrics = {
  currentScrollLeft: 0,
  currentScrollTop: 0,
  refreshScrollValues: function() {
    var scrollPosition = getUnboundedScrollPosition(window);
    ViewportMetrics.currentScrollLeft = scrollPosition.x;
    ViewportMetrics.currentScrollTop = scrollPosition.y;
  }
};
module.exports = ViewportMetrics;


},{"./getUnboundedScrollPosition":120}],100:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/accumulate";
"use strict";
var invariant = require("./invariant");
function accumulate(current, next) {
  ("production" !== process.env.NODE_ENV ? invariant(next != null, 'accumulate(...): Accumulated items must be not be null or undefined.') : invariant(next != null));
  if (current == null) {
    return next;
  } else {
    var currentIsArray = Array.isArray(current);
    var nextIsArray = Array.isArray(next);
    if (currentIsArray) {
      return current.concat(next);
    } else {
      if (nextIsArray) {
        return [current].concat(next);
      } else {
        return [current, next];
      }
    }
  }
}
module.exports = accumulate;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],101:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/adler32";
"use strict";
var MOD = 65521;
function adler32(data) {
  var a = 1;
  var b = 0;
  for (var i = 0; i < data.length; i++) {
    a = (a + data.charCodeAt(i)) % MOD;
    b = (b + a) % MOD;
  }
  return a | (b << 16);
}
module.exports = adler32;


},{}],102:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/containsNode";
var isTextNode = require("./isTextNode");
function containsNode(outerNode, innerNode) {
  if (!outerNode || !innerNode) {
    return false;
  } else if (outerNode === innerNode) {
    return true;
  } else if (isTextNode(outerNode)) {
    return false;
  } else if (isTextNode(innerNode)) {
    return containsNode(outerNode, innerNode.parentNode);
  } else if (outerNode.contains) {
    return outerNode.contains(innerNode);
  } else if (outerNode.compareDocumentPosition) {
    return !!(outerNode.compareDocumentPosition(innerNode) & 16);
  } else {
    return false;
  }
}
module.exports = containsNode;


},{"./isTextNode":126}],103:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/copyProperties";
function copyProperties(obj, a, b, c, d, e, f) {
  obj = obj || {};
  if ("production" !== process.env.NODE_ENV) {
    if (f) {
      throw new Error('Too many arguments passed to copyProperties');
    }
  }
  var args = [a, b, c, d, e];
  var ii = 0,
      v;
  while (args[ii]) {
    v = args[ii++];
    for (var k in v) {
      obj[k] = v[k];
    }
    if (v.hasOwnProperty && v.hasOwnProperty('toString') && (typeof v.toString != 'undefined') && (obj.toString !== v.toString)) {
      obj.toString = v.toString;
    }
  }
  return obj;
}
module.exports = copyProperties;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],104:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/createArrayFrom";
var toArray = require("./toArray");
function hasArrayNature(obj) {
  return (!!obj && (typeof obj == 'object' || typeof obj == 'function') && ('length' in obj) && !('setInterval' in obj) && (typeof obj.nodeType != 'number') && (((Array.isArray(obj) || ('callee' in obj) || 'item' in obj))));
}
function createArrayFrom(obj) {
  if (!hasArrayNature(obj)) {
    return [obj];
  } else if (Array.isArray(obj)) {
    return obj.slice();
  } else {
    return toArray(obj);
  }
}
module.exports = createArrayFrom;


},{"./toArray":141}],105:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/createFullPageComponent";
"use strict";
var ReactCompositeComponent = require("./ReactCompositeComponent");
var invariant = require("./invariant");
function createFullPageComponent(componentClass) {
  var FullPageComponent = ReactCompositeComponent.createClass({
    displayName: 'ReactFullPageComponent' + (componentClass.componentConstructor.displayName || ''),
    componentWillUnmount: function() {
      ("production" !== process.env.NODE_ENV ? invariant(false, '%s tried to unmount. Because of cross-browser quirks it is ' + 'impossible to unmount some top-level components (eg <html>, <head>, ' + 'and <body>) reliably and efficiently. To fix this, have a single ' + 'top-level component that never unmounts render these elements.', this.constructor.displayName) : invariant(false));
    },
    render: function() {
      return this.transferPropsTo(componentClass(null, this.props.children));
    }
  });
  return FullPageComponent;
}
module.exports = createFullPageComponent;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactCompositeComponent":43,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],106:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/createNodesFromMarkup";
var ExecutionEnvironment = require("./ExecutionEnvironment");
var createArrayFrom = require("./createArrayFrom");
var getMarkupWrap = require("./getMarkupWrap");
var invariant = require("./invariant");
var dummyNode = ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;
var nodeNamePattern = /^\s*<(\w+)/;
function getNodeName(markup) {
  var nodeNameMatch = markup.match(nodeNamePattern);
  return nodeNameMatch && nodeNameMatch[1].toLowerCase();
}
function createNodesFromMarkup(markup, handleScript) {
  var node = dummyNode;
  ("production" !== process.env.NODE_ENV ? invariant(!!dummyNode, 'createNodesFromMarkup dummy not initialized') : invariant(!!dummyNode));
  var nodeName = getNodeName(markup);
  var wrap = nodeName && getMarkupWrap(nodeName);
  if (wrap) {
    node.innerHTML = wrap[1] + markup + wrap[2];
    var wrapDepth = wrap[0];
    while (wrapDepth--) {
      node = node.lastChild;
    }
  } else {
    node.innerHTML = markup;
  }
  var scripts = node.getElementsByTagName('script');
  if (scripts.length) {
    ("production" !== process.env.NODE_ENV ? invariant(handleScript, 'createNodesFromMarkup(...): Unexpected <script> element rendered.') : invariant(handleScript));
    createArrayFrom(scripts).forEach(handleScript);
  }
  var nodes = createArrayFrom(node.childNodes);
  while (node.lastChild) {
    node.removeChild(node.lastChild);
  }
  return nodes;
}
module.exports = createNodesFromMarkup;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ExecutionEnvironment":34,"./createArrayFrom":104,"./getMarkupWrap":116,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],107:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/createObjectFrom";
function createObjectFrom(keys, values) {
  if ("production" !== process.env.NODE_ENV) {
    if (!Array.isArray(keys)) {
      throw new TypeError('Must pass an array of keys.');
    }
  }
  var object = {};
  var isArray = Array.isArray(values);
  if (typeof values == 'undefined') {
    values = true;
  }
  for (var ii = keys.length; ii--; ) {
    object[keys[ii]] = isArray ? values[ii] : values;
  }
  return object;
}
module.exports = createObjectFrom;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],108:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/dangerousStyleValue";
"use strict";
var CSSProperty = require("./CSSProperty");
function dangerousStyleValue(styleName, value) {
  var isEmpty = value == null || typeof value === 'boolean' || value === '';
  if (isEmpty) {
    return '';
  }
  var isNonNumeric = isNaN(value);
  if (isNonNumeric || value === 0 || CSSProperty.isUnitlessNumber[styleName]) {
    return '' + value;
  }
  return value + 'px';
}
module.exports = dangerousStyleValue;


},{"./CSSProperty":16}],109:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/emptyFunction";
var copyProperties = require("./copyProperties");
function makeEmptyFunction(arg) {
  return function() {
    return arg;
  };
}
function emptyFunction() {}
copyProperties(emptyFunction, {
  thatReturns: makeEmptyFunction,
  thatReturnsFalse: makeEmptyFunction(false),
  thatReturnsTrue: makeEmptyFunction(true),
  thatReturnsNull: makeEmptyFunction(null),
  thatReturnsThis: function() {
    return this;
  },
  thatReturnsArgument: function(arg) {
    return arg;
  }
});
module.exports = emptyFunction;


},{"./copyProperties":103}],110:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/escapeTextForBrowser";
"use strict";
var ESCAPE_LOOKUP = {
  "&": "&amp;",
  ">": "&gt;",
  "<": "&lt;",
  "\"": "&quot;",
  "'": "&#x27;",
  "/": "&#x2f;"
};
var ESCAPE_REGEX = /[&><"'\/]/g;
function escaper(match) {
  return ESCAPE_LOOKUP[match];
}
function escapeTextForBrowser(text) {
  return ('' + text).replace(ESCAPE_REGEX, escaper);
}
module.exports = escapeTextForBrowser;


},{}],111:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/flattenChildren";
"use strict";
var invariant = require("./invariant");
var traverseAllChildren = require("./traverseAllChildren");
function flattenSingleChildIntoContext(traverseContext, child, name) {
  var result = traverseContext;
  ("production" !== process.env.NODE_ENV ? invariant(!result.hasOwnProperty(name), 'flattenChildren(...): Encountered two children with the same key, `%s`. ' + 'Children keys must be unique.', name) : invariant(!result.hasOwnProperty(name)));
  if (child != null) {
    result[name] = child;
  }
}
function flattenChildren(children) {
  if (children == null) {
    return children;
  }
  var result = {};
  traverseAllChildren(children, flattenSingleChildIntoContext, result);
  return result;
}
module.exports = flattenChildren;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"./traverseAllChildren":142,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],112:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/forEachAccumulated";
"use strict";
var forEachAccumulated = function(arr, cb, scope) {
  if (Array.isArray(arr)) {
    arr.forEach(cb, scope);
  } else if (arr) {
    cb.call(scope, arr);
  }
};
module.exports = forEachAccumulated;


},{}],113:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/getActiveElement";
function getActiveElement() {
  try {
    return document.activeElement || document.body;
  } catch (e) {
    return document.body;
  }
}
module.exports = getActiveElement;


},{}],114:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/getEventKey";
"use strict";
var normalizeKey = {
  'Esc': 'Escape',
  'Spacebar': ' ',
  'Left': 'ArrowLeft',
  'Up': 'ArrowUp',
  'Right': 'ArrowRight',
  'Down': 'ArrowDown',
  'Del': 'Delete',
  'Win': 'OS',
  'Menu': 'ContextMenu',
  'Apps': 'ContextMenu',
  'Scroll': 'ScrollLock',
  'MozPrintableKey': 'Unidentified'
};
var translateToKey = {
  8: 'Backspace',
  9: 'Tab',
  12: 'Clear',
  13: 'Enter',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  19: 'Pause',
  20: 'CapsLock',
  27: 'Escape',
  32: ' ',
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  45: 'Insert',
  46: 'Delete',
  112: 'F1',
  113: 'F2',
  114: 'F3',
  115: 'F4',
  116: 'F5',
  117: 'F6',
  118: 'F7',
  119: 'F8',
  120: 'F9',
  121: 'F10',
  122: 'F11',
  123: 'F12',
  144: 'NumLock',
  145: 'ScrollLock',
  224: 'Meta'
};
function getEventKey(nativeEvent) {
  return 'key' in nativeEvent ? normalizeKey[nativeEvent.key] || nativeEvent.key : translateToKey[nativeEvent.which || nativeEvent.keyCode] || 'Unidentified';
}
module.exports = getEventKey;


},{}],115:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/getEventTarget";
"use strict";
function getEventTarget(nativeEvent) {
  var target = nativeEvent.target || nativeEvent.srcElement || window;
  return target.nodeType === 3 ? target.parentNode : target;
}
module.exports = getEventTarget;


},{}],116:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/getMarkupWrap";
var ExecutionEnvironment = require("./ExecutionEnvironment");
var invariant = require("./invariant");
var dummyNode = ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;
var shouldWrap = {
  'circle': true,
  'defs': true,
  'g': true,
  'line': true,
  'linearGradient': true,
  'path': true,
  'polygon': true,
  'polyline': true,
  'radialGradient': true,
  'rect': true,
  'stop': true,
  'text': true
};
var selectWrap = [1, '<select multiple="true">', '</select>'];
var tableWrap = [1, '<table>', '</table>'];
var trWrap = [3, '<table><tbody><tr>', '</tr></tbody></table>'];
var svgWrap = [1, '<svg>', '</svg>'];
var markupWrap = {
  '*': [1, '?<div>', '</div>'],
  'area': [1, '<map>', '</map>'],
  'col': [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  'legend': [1, '<fieldset>', '</fieldset>'],
  'param': [1, '<object>', '</object>'],
  'tr': [2, '<table><tbody>', '</tbody></table>'],
  'optgroup': selectWrap,
  'option': selectWrap,
  'caption': tableWrap,
  'colgroup': tableWrap,
  'tbody': tableWrap,
  'tfoot': tableWrap,
  'thead': tableWrap,
  'td': trWrap,
  'th': trWrap,
  'circle': svgWrap,
  'defs': svgWrap,
  'g': svgWrap,
  'line': svgWrap,
  'linearGradient': svgWrap,
  'path': svgWrap,
  'polygon': svgWrap,
  'polyline': svgWrap,
  'radialGradient': svgWrap,
  'rect': svgWrap,
  'stop': svgWrap,
  'text': svgWrap
};
function getMarkupWrap(nodeName) {
  ("production" !== process.env.NODE_ENV ? invariant(!!dummyNode, 'Markup wrapping node not initialized') : invariant(!!dummyNode));
  if (!markupWrap.hasOwnProperty(nodeName)) {
    nodeName = '*';
  }
  if (!shouldWrap.hasOwnProperty(nodeName)) {
    if (nodeName === '*') {
      dummyNode.innerHTML = '<link />';
    } else {
      dummyNode.innerHTML = '<' + nodeName + '></' + nodeName + '>';
    }
    shouldWrap[nodeName] = !dummyNode.firstChild;
  }
  return shouldWrap[nodeName] ? markupWrap[nodeName] : null;
}
module.exports = getMarkupWrap;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ExecutionEnvironment":34,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],117:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/getNodeForCharacterOffset";
"use strict";
function getLeafNode(node) {
  while (node && node.firstChild) {
    node = node.firstChild;
  }
  return node;
}
function getSiblingNode(node) {
  while (node) {
    if (node.nextSibling) {
      return node.nextSibling;
    }
    node = node.parentNode;
  }
}
function getNodeForCharacterOffset(root, offset) {
  var node = getLeafNode(root);
  var nodeStart = 0;
  var nodeEnd = 0;
  while (node) {
    if (node.nodeType == 3) {
      nodeEnd = nodeStart + node.textContent.length;
      if (nodeStart <= offset && nodeEnd >= offset) {
        return {
          node: node,
          offset: offset - nodeStart
        };
      }
      nodeStart = nodeEnd;
    }
    node = getLeafNode(getSiblingNode(node));
  }
}
module.exports = getNodeForCharacterOffset;


},{}],118:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/getReactRootElementInContainer";
"use strict";
var DOC_NODE_TYPE = 9;
function getReactRootElementInContainer(container) {
  if (!container) {
    return null;
  }
  if (container.nodeType === DOC_NODE_TYPE) {
    return container.documentElement;
  } else {
    return container.firstChild;
  }
}
module.exports = getReactRootElementInContainer;


},{}],119:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/getTextContentAccessor";
"use strict";
var ExecutionEnvironment = require("./ExecutionEnvironment");
var contentKey = null;
function getTextContentAccessor() {
  if (!contentKey && ExecutionEnvironment.canUseDOM) {
    contentKey = 'textContent' in document.createElement('div') ? 'textContent' : 'innerText';
  }
  return contentKey;
}
module.exports = getTextContentAccessor;


},{"./ExecutionEnvironment":34}],120:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/getUnboundedScrollPosition";
"use strict";
function getUnboundedScrollPosition(scrollable) {
  if (scrollable === window) {
    return {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };
  }
  return {
    x: scrollable.scrollLeft,
    y: scrollable.scrollTop
  };
}
module.exports = getUnboundedScrollPosition;


},{}],121:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/hyphenate";
var _uppercasePattern = /([A-Z])/g;
function hyphenate(string) {
  return string.replace(_uppercasePattern, '-$1').toLowerCase();
}
module.exports = hyphenate;


},{}],122:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/invariant";
"use strict";
var invariant = function(condition) {
  if (!condition) {
    var error = new Error('Minified exception occured; use the non-minified dev environment for ' + 'the full error message and additional helpful warnings.');
    error.framesToPop = 1;
    throw error;
  }
};
if ("production" !== process.env.NODE_ENV) {
  invariant = function(condition, format, a, b, c, d, e, f) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
    if (!condition) {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      var error = new Error('Invariant Violation: ' + format.replace(/%s/g, function() {
        return args[argIndex++];
      }));
      error.framesToPop = 1;
      throw error;
    }
  };
}
module.exports = invariant;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],123:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/isEventSupported";
"use strict";
var ExecutionEnvironment = require("./ExecutionEnvironment");
var useHasFeature;
if (ExecutionEnvironment.canUseDOM) {
  useHasFeature = document.implementation && document.implementation.hasFeature && document.implementation.hasFeature('', '') !== true;
}
function isEventSupported(eventNameSuffix, capture) {
  if (!ExecutionEnvironment.canUseDOM || capture && !('addEventListener' in document)) {
    return false;
  }
  var eventName = 'on' + eventNameSuffix;
  var isSupported = eventName in document;
  if (!isSupported) {
    var element = document.createElement('div');
    element.setAttribute(eventName, 'return;');
    isSupported = typeof element[eventName] === 'function';
  }
  if (!isSupported && useHasFeature && eventNameSuffix === 'wheel') {
    isSupported = document.implementation.hasFeature('Events.wheel', '3.0');
  }
  return isSupported;
}
module.exports = isEventSupported;


},{"./ExecutionEnvironment":34}],124:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/isNode";
function isNode(object) {
  return !!(object && (typeof Node !== 'undefined' ? object instanceof Node : typeof object === 'object' && typeof object.nodeType === 'number' && typeof object.nodeName === 'string'));
}
module.exports = isNode;


},{}],125:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/isTextInputElement";
"use strict";
var supportedInputTypes = {
  'color': true,
  'date': true,
  'datetime': true,
  'datetime-local': true,
  'email': true,
  'month': true,
  'number': true,
  'password': true,
  'range': true,
  'search': true,
  'tel': true,
  'text': true,
  'time': true,
  'url': true,
  'week': true
};
function isTextInputElement(elem) {
  return elem && ((elem.nodeName === 'INPUT' && supportedInputTypes[elem.type]) || elem.nodeName === 'TEXTAREA');
}
module.exports = isTextInputElement;


},{}],126:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/isTextNode";
var isNode = require("./isNode");
function isTextNode(object) {
  return isNode(object) && object.nodeType == 3;
}
module.exports = isTextNode;


},{"./isNode":124}],127:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/joinClasses";
"use strict";
function joinClasses(className) {
  if (!className) {
    className = '';
  }
  var nextClass;
  var argLength = arguments.length;
  if (argLength > 1) {
    for (var ii = 1; ii < argLength; ii++) {
      nextClass = arguments[ii];
      nextClass && (className += ' ' + nextClass);
    }
  }
  return className;
}
module.exports = joinClasses;


},{}],128:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/keyMirror";
"use strict";
var invariant = require("./invariant");
var keyMirror = function(obj) {
  var ret = {};
  var key;
  ("production" !== process.env.NODE_ENV ? invariant(obj instanceof Object && !Array.isArray(obj), 'keyMirror(...): Argument must be an object.') : invariant(obj instanceof Object && !Array.isArray(obj)));
  for (key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }
    ret[key] = key;
  }
  return ret;
};
module.exports = keyMirror;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],129:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/keyOf";
var keyOf = function(oneKeyObj) {
  var key;
  for (key in oneKeyObj) {
    if (!oneKeyObj.hasOwnProperty(key)) {
      continue;
    }
    return key;
  }
  return null;
};
module.exports = keyOf;


},{}],130:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/memoizeStringOnly";
"use strict";
function memoizeStringOnly(callback) {
  var cache = {};
  return function(string) {
    if (cache.hasOwnProperty(string)) {
      return cache[string];
    } else {
      return cache[string] = callback.call(this, string);
    }
  };
}
module.exports = memoizeStringOnly;


},{}],131:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/merge";
"use strict";
var mergeInto = require("./mergeInto");
var merge = function(one, two) {
  var result = {};
  mergeInto(result, one);
  mergeInto(result, two);
  return result;
};
module.exports = merge;


},{"./mergeInto":133}],132:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/mergeHelpers";
"use strict";
var invariant = require("./invariant");
var keyMirror = require("./keyMirror");
var MAX_MERGE_DEPTH = 36;
var isTerminal = function(o) {
  return typeof o !== 'object' || o === null;
};
var mergeHelpers = {
  MAX_MERGE_DEPTH: MAX_MERGE_DEPTH,
  isTerminal: isTerminal,
  normalizeMergeArg: function(arg) {
    return arg === undefined || arg === null ? {} : arg;
  },
  checkMergeArrayArgs: function(one, two) {
    ("production" !== process.env.NODE_ENV ? invariant(Array.isArray(one) && Array.isArray(two), 'Tried to merge arrays, instead got %s and %s.', one, two) : invariant(Array.isArray(one) && Array.isArray(two)));
  },
  checkMergeObjectArgs: function(one, two) {
    mergeHelpers.checkMergeObjectArg(one);
    mergeHelpers.checkMergeObjectArg(two);
  },
  checkMergeObjectArg: function(arg) {
    ("production" !== process.env.NODE_ENV ? invariant(!isTerminal(arg) && !Array.isArray(arg), 'Tried to merge an object, instead got %s.', arg) : invariant(!isTerminal(arg) && !Array.isArray(arg)));
  },
  checkMergeLevel: function(level) {
    ("production" !== process.env.NODE_ENV ? invariant(level < MAX_MERGE_DEPTH, 'Maximum deep merge depth exceeded. You may be attempting to merge ' + 'circular structures in an unsupported way.') : invariant(level < MAX_MERGE_DEPTH));
  },
  checkArrayStrategy: function(strategy) {
    ("production" !== process.env.NODE_ENV ? invariant(strategy === undefined || strategy in mergeHelpers.ArrayStrategies, 'You must provide an array strategy to deep merge functions to ' + 'instruct the deep merge how to resolve merging two arrays.') : invariant(strategy === undefined || strategy in mergeHelpers.ArrayStrategies));
  },
  ArrayStrategies: keyMirror({
    Clobber: true,
    IndexByIndex: true
  })
};
module.exports = mergeHelpers;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"./keyMirror":128,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],133:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/mergeInto";
"use strict";
var mergeHelpers = require("./mergeHelpers");
var checkMergeObjectArg = mergeHelpers.checkMergeObjectArg;
function mergeInto(one, two) {
  checkMergeObjectArg(one);
  if (two != null) {
    checkMergeObjectArg(two);
    for (var key in two) {
      if (!two.hasOwnProperty(key)) {
        continue;
      }
      one[key] = two[key];
    }
  }
}
module.exports = mergeInto;


},{"./mergeHelpers":132}],134:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/mixInto";
"use strict";
var mixInto = function(constructor, methodBag) {
  var methodName;
  for (methodName in methodBag) {
    if (!methodBag.hasOwnProperty(methodName)) {
      continue;
    }
    constructor.prototype[methodName] = methodBag[methodName];
  }
};
module.exports = mixInto;


},{}],135:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/objMap";
"use strict";
function objMap(obj, func, context) {
  if (!obj) {
    return null;
  }
  var i = 0;
  var ret = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret[key] = func.call(context, obj[key], key, i++);
    }
  }
  return ret;
}
module.exports = objMap;


},{}],136:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/objMapKeyVal";
"use strict";
function objMapKeyVal(obj, func, context) {
  if (!obj) {
    return null;
  }
  var i = 0;
  var ret = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret[key] = func.call(context, key, obj[key], i++);
    }
  }
  return ret;
}
module.exports = objMapKeyVal;


},{}],137:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/onlyChild";
"use strict";
var ReactComponent = require("./ReactComponent");
var invariant = require("./invariant");
function onlyChild(children) {
  ("production" !== process.env.NODE_ENV ? invariant(ReactComponent.isValidComponent(children), 'onlyChild must be passed a children with exactly one child.') : invariant(ReactComponent.isValidComponent(children)));
  return children;
}
module.exports = onlyChild;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactComponent":40,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],138:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/performanceNow";
"use strict";
var ExecutionEnvironment = require("./ExecutionEnvironment");
var performance = null;
if (ExecutionEnvironment.canUseDOM) {
  performance = window.performance || window.webkitPerformance;
}
if (!performance || !performance.now) {
  performance = Date;
}
var performanceNow = performance.now.bind(performance);
module.exports = performanceNow;


},{"./ExecutionEnvironment":34}],139:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/lib/shallowEqual";
"use strict";
function shallowEqual(objA, objB) {
  if (objA === objB) {
    return true;
  }
  var key;
  for (key in objA) {
    if (objA.hasOwnProperty(key) && (!objB.hasOwnProperty(key) || objA[key] !== objB[key])) {
      return false;
    }
  }
  for (key in objB) {
    if (objB.hasOwnProperty(key) && !objA.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}
module.exports = shallowEqual;


},{}],140:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/shouldUpdateReactComponent";
"use strict";
function shouldUpdateReactComponent(prevComponent, nextComponent) {
  if (prevComponent && nextComponent && prevComponent.constructor === nextComponent.constructor && ((prevComponent.props && prevComponent.props.key) === (nextComponent.props && nextComponent.props.key))) {
    if (prevComponent._owner === nextComponent._owner) {
      return true;
    } else {
      if ("production" !== process.env.NODE_ENV) {
        if (prevComponent.state) {
          console.warn('A recent change to React has been found to impact your code. ' + 'A mounted component will now be unmounted and replaced by a ' + 'component (of the same class) if their owners are different. ' + 'Previously, ownership was not considered when updating.', prevComponent, nextComponent);
        }
      }
    }
  }
  return false;
}
module.exports = shouldUpdateReactComponent;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],141:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/toArray";
var invariant = require("./invariant");
function toArray(obj) {
  var length = obj.length;
  ("production" !== process.env.NODE_ENV ? invariant(!Array.isArray(obj) && (typeof obj === 'object' || typeof obj === 'function'), 'toArray: Array-like object expected') : invariant(!Array.isArray(obj) && (typeof obj === 'object' || typeof obj === 'function')));
  ("production" !== process.env.NODE_ENV ? invariant(typeof length === 'number', 'toArray: Object needs a length property') : invariant(typeof length === 'number'));
  ("production" !== process.env.NODE_ENV ? invariant(length === 0 || (length - 1) in obj, 'toArray: Object should have keys for indices') : invariant(length === 0 || (length - 1) in obj));
  if (obj.hasOwnProperty) {
    try {
      return Array.prototype.slice.call(obj);
    } catch (e) {}
  }
  var ret = Array(length);
  for (var ii = 0; ii < length; ii++) {
    ret[ii] = obj[ii];
  }
  return ret;
}
module.exports = toArray;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],142:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/traverseAllChildren";
"use strict";
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactTextComponent = require("./ReactTextComponent");
var invariant = require("./invariant");
var SEPARATOR = ReactInstanceHandles.SEPARATOR;
var SUBSEPARATOR = ':';
var userProvidedKeyEscaperLookup = {
  '=': '=0',
  '.': '=1',
  ':': '=2'
};
var userProvidedKeyEscapeRegex = /[=.:]/g;
function userProvidedKeyEscaper(match) {
  return userProvidedKeyEscaperLookup[match];
}
function getComponentKey(component, index) {
  if (component && component.props && component.props.key != null) {
    return wrapUserProvidedKey(component.props.key);
  }
  return index.toString(36);
}
function escapeUserProvidedKey(text) {
  return ('' + text).replace(userProvidedKeyEscapeRegex, userProvidedKeyEscaper);
}
function wrapUserProvidedKey(key) {
  return '$' + escapeUserProvidedKey(key);
}
var traverseAllChildrenImpl = function(children, nameSoFar, indexSoFar, callback, traverseContext) {
  var subtreeCount = 0;
  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var nextName = (nameSoFar + (nameSoFar ? SUBSEPARATOR : SEPARATOR) + getComponentKey(child, i));
      var nextIndex = indexSoFar + subtreeCount;
      subtreeCount += traverseAllChildrenImpl(child, nextName, nextIndex, callback, traverseContext);
    }
  } else {
    var type = typeof children;
    var isOnlyChild = nameSoFar === '';
    var storageName = isOnlyChild ? SEPARATOR + getComponentKey(children, 0) : nameSoFar;
    if (children == null || type === 'boolean') {
      callback(traverseContext, null, storageName, indexSoFar);
      subtreeCount = 1;
    } else if (children.mountComponentIntoNode) {
      callback(traverseContext, children, storageName, indexSoFar);
      subtreeCount = 1;
    } else {
      if (type === 'object') {
        ("production" !== process.env.NODE_ENV ? invariant(!children || children.nodeType !== 1, 'traverseAllChildren(...): Encountered an invalid child; DOM ' + 'elements are not valid children of React components.') : invariant(!children || children.nodeType !== 1));
        for (var key in children) {
          if (children.hasOwnProperty(key)) {
            subtreeCount += traverseAllChildrenImpl(children[key], (nameSoFar + (nameSoFar ? SUBSEPARATOR : SEPARATOR) + wrapUserProvidedKey(key) + SUBSEPARATOR + getComponentKey(children[key], 0)), indexSoFar + subtreeCount, callback, traverseContext);
          }
        }
      } else if (type === 'string') {
        var normalizedText = new ReactTextComponent(children);
        callback(traverseContext, normalizedText, storageName, indexSoFar);
        subtreeCount += 1;
      } else if (type === 'number') {
        var normalizedNumber = new ReactTextComponent('' + children);
        callback(traverseContext, normalizedNumber, storageName, indexSoFar);
        subtreeCount += 1;
      }
    }
  }
  return subtreeCount;
};
function traverseAllChildren(children, callback, traverseContext) {
  if (children !== null && children !== undefined) {
    traverseAllChildrenImpl(children, '', 0, callback, traverseContext);
  }
}
module.exports = traverseAllChildren;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./ReactInstanceHandles":67,"./ReactTextComponent":83,"./invariant":122,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],143:[function(require,module,exports){
(function (process){
"use strict";
var __moduleName = "node_modules/react/lib/warning";
"use strict";
var emptyFunction = require("./emptyFunction");
var warning = emptyFunction;
if ("production" !== process.env.NODE_ENV) {
  warning = function(condition, format) {
    var args = Array.prototype.slice.call(arguments, 2);
    if (format === undefined) {
      throw new Error('`warning(condition, format, ...args)` requires a warning ' + 'message argument');
    }
    if (!condition) {
      var argIndex = 0;
      console.warn('Warning: ' + format.replace(/%s/g, function() {
        return args[argIndex++];
      }));
    }
  };
}
module.exports = warning;


}).call(this,require("/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js"))
},{"./emptyFunction":109,"/home/dave/projects/go/src/github.com/dobrite/fluxchat/node_modules/browserify/node_modules/process/browser.js":2}],144:[function(require,module,exports){
"use strict";
var __moduleName = "node_modules/react/react";
module.exports = require('./lib/React');


},{"./lib/React":38}],145:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/actions/FluxChatActions";
"use strict";
var __moduleName = "src/javascripts/actions/FluxChatActions";
var AppDispatcher = require('../dispatcher/AppDispatcher');
var FluxChatConstants = require('../constants/FluxChatConstants');
var FluxChatActions = {
  initialize: function() {
    AppDispatcher.handlePushAction({actionType: FluxChatConstants.PUSHSTREAM_INITIALIZE});
  },
  connect: function(channel) {
    AppDispatcher.handlePushAction({
      actionType: FluxChatConstants.PUSHSTREAM_CONNECT,
      channel: channel
    });
  },
  sendMessage: function(message) {
    AppDispatcher.handleViewAction({
      actionType: FluxChatConstants.CHAT_SEND_MESSAGE,
      message: message
    });
  }
};
module.exports = FluxChatActions;


},{"../constants/FluxChatConstants":151,"../dispatcher/AppDispatcher":152}],146:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/app";
"use strict";
var __moduleName = "src/javascripts/app";
var React = require("react").default;
var FluxChat = require("./components/FluxChat.react").default;
React.renderComponent(FluxChat(), document.getElementById('fluxchat'));


},{"./components/FluxChat.react":148,"react":144}],147:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/components/ChatBar.react";
"use strict";
var __moduleName = "src/javascripts/components/ChatBar.react";
var React = require('react');
var FluxChatActions = require('../actions/FluxChatActions');
var ENTER_KEY_CODE = 13;
var ChatBar = React.createClass({
  displayName: 'ChatBar',
  getInitialState: function() {
    return {sayFormInputValue: ''};
  },
  render: function() {
    return (React.DOM.form({className: "say-form"}, React.DOM.input({
      className: "say-form__input",
      type: "text",
      value: this.state.sayFormInputValue,
      ref: "sayFormInput",
      onKeyDown: this._onKeyDown,
      onChange: this._onChange
    }), React.DOM.input({
      className: "say-form__button",
      type: "button",
      value: "Say!",
      onClick: this._onButtonClick
    })));
  },
  _onKeyDown: function(event) {
    if (event.keyCode === ENTER_KEY_CODE) {
      event.preventDefault();
      FluxChatActions.sendMessage(event.target.value);
      this.setState({sayFormInputValue: ''});
    }
  },
  _onChange: function(event) {
    this.setState({sayFormInputValue: event.target.value});
  },
  _onButtonClick: function(event) {
    var value = this.refs['sayFormInput'].getDOMNode().value;
    FluxChatActions.sendMessage(value);
    this.setState({sayFormInputValue: ''});
  }
});
module.exports = ChatBar;


},{"../actions/FluxChatActions":145,"react":144}],148:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/components/FluxChat.react";
"use strict";
var __moduleName = "src/javascripts/components/FluxChat.react";
var React = require('react');
var MessagePane = require('./MessagePane.react');
var ChatBar = require('./ChatBar.react');
var FluxChatActions = require('../actions/FluxChatActions');
var FluxChatStore = require('../stores/FluxChatStore');
var getFluxChatState = function() {
  return {allMessages: FluxChatStore.getAll()};
};
var FluxChat = React.createClass({
  displayName: 'FluxChat',
  getInitialState: function() {
    return getFluxChatState();
  },
  componentWillMount: function() {
    FluxChatActions.initialize();
    FluxChatActions.connect('example');
  },
  componentDidMount: function() {
    FluxChatStore.addListener('change', this._onChange);
  },
  componentWillUnmount: function() {
    FluxChatStore.removeListener('change', this._onChange);
  },
  render: function() {
    return (React.DOM.div(null, MessagePane({allMessages: this.state.allMessages}), ChatBar(null)));
  },
  _onChange: function() {
    this.setState(getFluxChatState());
  }
});
module.exports = FluxChat;


},{"../actions/FluxChatActions":145,"../stores/FluxChatStore":154,"./ChatBar.react":147,"./MessagePane.react":150,"react":144}],149:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/components/Message.react";
"use strict";
var __moduleName = "src/javascripts/components/Message.react";
var React = require('react');
var ReactPropTypes = React.PropTypes;
var Message = React.createClass({
  displayName: 'Message',
  propTypes: {message: ReactPropTypes.object.isRequired},
  render: function() {
    var message = this.props.message;
    return (React.DOM.li({key: message.timestamp}, message.timestamp, " ", message.text));
  }
});
module.exports = Message;


},{"react":144}],150:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/components/MessagePane.react";
"use strict";
var __moduleName = "src/javascripts/components/MessagePane.react";
var React = require('react');
var ReactPropTypes = React.PropTypes;
var Message = require('./Message.react');
var MessagePane = React.createClass({
  displayName: 'MessagePane',
  propTypes: {allMessages: ReactPropTypes.object.isRequired},
  render: function() {
    var allMessages = this.props.allMessages;
    var messages = [];
    for (var key in allMessages) {
      messages.push(Message({
        key: key,
        message: allMessages[key]
      }));
    }
    return (React.DOM.section(null, React.DOM.ol(null, messages)));
  }
});
module.exports = MessagePane;


},{"./Message.react":149,"react":144}],151:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/constants/FluxChatConstants";
"use strict";
var __moduleName = "src/javascripts/constants/FluxChatConstants";
var keyMirror = require('react/lib/keyMirror');
module.exports = keyMirror({
  PUSHSTREAM_INITIALIZE: null,
  PUSHSTREAM_CONNECT: null,
  CHAT_SEND_MESSAGE: null
});


},{"react/lib/keyMirror":128}],152:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/dispatcher/AppDispatcher";
"use strict";
var __moduleName = "src/javascripts/dispatcher/AppDispatcher";
var Dispatcher = require('./Dispatcher');
var merge = require('react/lib/merge');
var AppDispatcher = merge(Dispatcher.prototype, {
  handlePushAction: function(action) {
    this.dispatch({
      source: 'PUSH_ACTION',
      action: action
    });
  },
  handleViewAction: function(action) {
    this.dispatch({
      source: 'VIEW_ACTION',
      action: action
    });
  }
});
module.exports = AppDispatcher;


},{"./Dispatcher":153,"react/lib/merge":131}],153:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/dispatcher/Dispatcher";
"use strict";
var __moduleName = "src/javascripts/dispatcher/Dispatcher";
var Promise = require('es6-promise').Promise;
var merge = require('react/lib/merge');
var _callbacks = [];
var _promises = [];
var _addPromise = function(callback, payload) {
  _promises.push(new Promise(function(resolve, reject) {
    if (callback(payload)) {
      resolve(payload);
    } else {
      reject(new Error('Dispatcher callback unsuccessful'));
    }
  }));
};
var _clearPromises = function() {
  _promises = [];
};
var Dispatcher = function() {};
Dispatcher.prototype = merge(Dispatcher.prototype, {
  register: function(callback) {
    _callbacks.push(callback);
    return _callbacks.length - 1;
  },
  dispatch: function(payload) {
    _callbacks.forEach(function(callback) {
      _addPromise(callback, payload);
    });
    Promise.all(_promises).then(_clearPromises);
  },
  waitFor: function(promiseIndexes, callback) {
    var selectedPromises = _promises.filter(function(_, j) {
      return promiseIndexes.indexOf(j) !== -1;
    });
    Promise.all(selectedPromises).then(callback);
  }
});
module.exports = Dispatcher;


},{"es6-promise":3,"react/lib/merge":131}],154:[function(require,module,exports){
"use strict";
var __moduleName = "src/javascripts/stores/FluxChatStore";
"use strict";
var __moduleName = "src/javascripts/stores/FluxChatStore";
var AppDispatcher = require('../dispatcher/AppDispatcher'),
    FluxChatConstants = require('../constants/FluxChatConstants'),
    EventEmitter = require('events').EventEmitter,
    merge = require('react/lib/merge');
var CHANGE_EVENT = 'change',
    pushstream,
    _messages = [];
_messages = {
  1401123696308: {
    id: 1,
    text: "YO!",
    timestamp: "2014-05-26T17:01:36.308741214Z"
  },
  1401123697308: {
    id: 2,
    text: "Word up!",
    timestamp: "2014-05-26T17:01:37.308741214Z"
  },
  1401123698308: {
    id: 3,
    text: "third",
    timestamp: "2014-05-26T17:01:38.308741214Z"
  }
};
var initialize = function() {
  PushStream.LOG_LEVEL = 'debug';
  pushstream = window.pushstream = new PushStream({
    host: window.location.hostname,
    port: 9080,
    modes: "websocket|eventsource|stream"
  });
  pushstream.onmessage = manageEvent;
  pushstream.onstatuschange = statusChange;
};
var manageEvent = function(data, id, channel, eventid, isLastMessageFromBatch) {
  if (data === '')
    return;
  var message = JSON.parse(data),
      timestamp = new Date(message.timestamp).getTime();
  _messages[timestamp] = message;
  FluxChatStore.emitChange();
};
var statusChange = function(status) {
  console.log("sc", status);
};
var connect = function(channel) {
  pushstream.removeAllChannels();
  try {
    pushstream.addChannel(channel);
    pushstream.connect(channel);
  } catch (e) {
    alert(e);
  }
  console.log("connecting...");
};
var sendMessage = function(text) {
  var message = {
    text: text,
    nick: 'Nick'
  };
  var request = new XMLHttpRequest();
  request.open('POST', '/pub', true);
  request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  request.send(JSON.stringify(message));
};
var FluxChatStore = merge(EventEmitter.prototype, {
  getAll: function() {
    return _messages;
  },
  emitChange: function() {
    this.emit(CHANGE_EVENT);
  }
});
AppDispatcher.register(function(payload) {
  var action = payload.action;
  switch (action.actionType) {
    case FluxChatConstants.PUSHSTREAM_INITIALIZE:
      initialize();
      break;
    case FluxChatConstants.PUSHSTREAM_CONNECT:
      connect(action.channel);
      break;
    case FluxChatConstants.CHAT_SEND_MESSAGE:
      sendMessage(action.message);
      break;
    default:
      return true;
  }
  FluxChatStore.emitChange();
  return true;
});
module.exports = FluxChatStore;


},{"../constants/FluxChatConstants":151,"../dispatcher/AppDispatcher":152,"events":1,"react/lib/merge":131}]},{},[14,146])