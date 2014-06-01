// Karma configuration
module.exports = function(config) {
  config.set({
    basePath: 'src',
    frameworks: [
      'mocha',
      'chai',
      'browserify'
    ],
    files: [
      'test/**/*.spec.coffee'
    ],
    exclude: [],
    preprocessors: {
      'test/**/*': [
        'browserify'
      ]
    },
    browserify: {
      extensions: [
        '.coffee',
        '.cjsx'
      ]
    },
    reporters: [
      'progress'
    ],
    port: 9876,
    runnerPort: 9100,
    colors: true,
    logLevel: config.LOG_DEBUG,
    autoWatch: true,
    captureTimeout: 60000,
    singleRun: false,
    browsers: [
      'Chrome'
    ]
  });
};
