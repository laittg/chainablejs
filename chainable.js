module.exports = Chainable

/**
 * An object with chainable methods
 *
 * @param {Object} settings { manualExec: boolean, chainable: 'chainable' }
 */
function Chainable (settings) {
  var chain = this
  var cfg = settings || {}

  var errors = [] // errors from chained methods call
  var results = [] // results from chained methods call

  var api = cfg.chainable || 'chainable'

  var chainable = chain[api] = {
    settings: cfg,

    errors: function () {
      return errors
    },

    lastError: function () {
      return errors[errors.length - 1]
    },

    results: function () {
      return results
    },

    lastResult: function () {
      return results[results.length - 1]
    },

    add: 'fn',
    exec: 'fn'
  }

  // private collection of methods
  var methods = {}

  // add a chainable method
  // fn is an async function with done(err, result) callback
  chainable.add = function (methodName, fn) {
    // check if method name is a string
    if (typeof methodName !== 'string') throw new Error('Method name must be a string')

    // check reserved keyword
    if (methodName === api) throw new Error('Reserved keyword: ' + methodName)

    // check if fn is a function
    if (typeof fn !== 'function') throw new Error('Second argument must be an async function')

    // TODO: check if there's a done() callback inside fn()

    // add fn method to private collection methods{}
    methods[methodName] = fn

    // create a public method call
    createPublicMethod(methodName)
  }

  // create a public chainable method
  var createPublicMethod = function (methodName) {
    chain[methodName] = function (...params) {
      // prepare args[] to apply to real methods[methodName]
      var args = []
      for (var arg in arguments) {
        if (arguments.hasOwnProperty(arg)) {
          args[args.length] = arguments[arg]
        }
      }
      // queue the method call
      queueTask(function (done) {
        // args = [...params, done]
        args[args.length] = done
        // call method(...params, done)
        methods[methodName].apply(chain, args)
      })
      // return the chain object to make method chaining works
      return chain
    }
  }

  // queue tasks created from public method calls
  var executing
  var tasks = []

  var queueTask = function (fn) {
    tasks[tasks.length] = fn
    if (!chainable.settings.manualExec && !executing) breakchain()
  }

  // manually execute queued tasks
  chainable.exec = function (done) {
    if (!chainable.settings.manualExec) done('manualExec is set to false')
    else breakchain(done)
  }

  // break the chain
  var breakchain = function (done) {
    if (!executing) {
      executing = true
      errors = []
      results = []
      exec(done)
    }/*  else if (typeof done === 'function') {
      done('Executing...')
    } */
  }

  // execute tasks[0](), then slice item [0], loop until tasks[] empty or an err returned
  var exec = function (done) {
    tasks[0](function (err, result) {
      errors[errors.length] = err
      results[results.length] = result

      if (err) tasks = []
      else tasks.splice(0, 1)

      if (!err && tasks.length > 0) exec(done)
      else if (typeof done === 'function') done(errors, results)
    })
  }
}
