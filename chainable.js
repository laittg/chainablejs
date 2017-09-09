var async = require('./async.js')

module.exports = Chainable

/**
 * Create an object with chainable API calls
 *
 * @param {Object} settings
 *
 * settings = {
 *  manualExec: false
 * }
 */
function Chainable (config) {
  var chain = this
  var settings = config || {}

  // private collection of APIs
  var api = {}

  // add a chainable api
  // fn is an async function with done(err, result) callback
  chain.$add = function (apiName, fn) {
    // check if api name is a string
    if (typeof apiName !== 'string') throw new Error('API name must be a string')

    // check reserved keywords
    if (apiName.match(/^\$(add|exec)$/i)) throw new Error('Reserved keyword: ' + apiName)

    // check if fn is a function
    if (typeof fn !== 'function') throw new Error('Second argument must be an async function')

    // TODO: check if there's a done() callback inside fn()

    // add fn api to private collection api{}
    api[apiName] = fn

    // create a public api call
    createPublicAPI(apiName)
  }

  // create a public chainable api
  var createPublicAPI = function (apiName) {
    chain[apiName] = function (...params) {
      // prepare args[] to apply to real api[apiName]
      var args = []
      for (var arg in arguments) {
        if (arguments.hasOwnProperty(arg)) {
          args[args.length] = arguments[arg]
        }
      }
      // queue the api call
      queueTasks(function (done) {
        // args will be [...params, done]
        args[args.length] = done
        // will call fn api[name](...params, done), binding the chain object context
        api[apiName].apply(chain, args)
      })
      // return chain object to make api chaining works
      return chain
    }
  }

  // queue tasks that are created from public api calls
  var executing
  var tasks = []
  var queueTasks = function (fn) {
    tasks[tasks.length] = fn
    if (!settings.manualExec && !executing) breakchain()
  }

  // break the chain
  var breakchain = function (done) {
    if (!executing) {
      executing = true
      async.cometSeries(tasks, function alldone (err, results) {
        executing = false
        if (typeof done === 'function') done(err, results)
      })
    } else if (typeof done === 'function') {
      done('Executing...')
    }
  }

  // manually execute queued api calls
  chain.$exec = function (done) {
    breakchain(done)
  }
}
