module.exports = Chainable

/**
 * An object with chainable methods
 *
 * @param {Object} settings - { api: 'chains' }
 */
function Chainable (settings) {
  var chainable = this

  var methods = {} // private collection of method functions
  var tasks = [] // queue of tasks created from chainable method calls;
                 // tasks will call real functions in methods {}
  var results = [] // results from chained methods call
  var executing // chain execution status

  // chainable api properties and methods
  var api = (settings && settings.api) ? settings.api : 'chains'
  var chains = chainable[api] = {
    results: function () { return results },
    lastResult: function () { return results[results.length - 1] },
    clearResults: function () { results = [] },

    chainable: 'fn',
    exec: 'fn',
    parent: 'fn',

    onError: 'fn',
    catch: 'fn',

    onFinished: 'fn',
    done: 'fn'
  }

  /**
   * Api to register a chainable method,
   * fn is an async function with done(err, result) callback
   */
  chains.chainable = function (methodName, fn) {
    // validate method name and fn async function
    validateMethod(methodName, api)
    checkAsync(fn)

    // create a chainable method
    chainableMethod.call(chainable, api, methodName, fn, methods, tasks)

    // enable usage of .chainable().chainable()
    return this
  }

  /**
   * Execute the chain of queued methods
   */
  chains.exec = function () {
    if (executing) return
    executing = true
    results = []
    exec.call(this, tasks, results)
  }

  /**
   * Returns access to parent chainable object when working with chains api
   */
  chains.parent = function () {
    return chainable
  }

  /**
   * Handle chains execution error
   * Usage: chainable.chains.catch(function (err, results) {})
   */
  chains.catch = function (fn) {
    if (typeof fn === 'function') chains.onError = fn
    else throw new Error('Error handler is not a function: ' + fn)
    return this
  }

  /**
   * Handle when chains execution finished successfully
   * Usage: chainable.chains.done(function (results) {})
   */
  chains.done = function (fn) {
    if (typeof fn === 'function') chains.onFinished = fn
    else throw new Error('Done handler is not a function: ' + fn)
    return this
  }

  /**
   * Api to chain a custom function fn
   * params will be passed to fn by this structure:
   * .then(
   *   function (p1, p2, p3, done) {
   *     done(err, result)
   *   },
   *   [p1, p2, p3]
   * )
   */
  chainable.then = function (fn, params) {
    // check if fn is an async function
    checkAsync(fn)

    // queue the custom function call
    var args = params || []
    tasks[tasks.length] = function (done) {
      args[args.length] = done
      fn.apply(chainable, args)
    }

    // invoke chains execution
    chains.exec()

    return this
  }
}

// HELPERS
// =======================================================================

/**
 * Check if fn is an async function
 * - should has at least one parameter which is a callback function
 * - should call the callback function
 *
 * @param {Function} fn
 */
function checkAsync (fn) {
  if (typeof fn !== 'function') throw new Error('Not a function: ' + fn)

  var src = fn.toString().replace(/\/\/.*/g, '')
  var params
  try {
    params = src.match(/^function[^(]*\(([^)]*)\)/)[1].replace(/\s+/g, '').split(',')
  } catch (error) {
    throw error
  }
  if (params[0] === '') throw new Error('There is no callback in the function below\n\n' + fn.toString())

  var lastparam = params[params.length - 1]
  var cb = new RegExp(lastparam + '\\s*\\(')
  if (!cb.test(src)) throw new Error(lastparam + ' is expected to be a callback, but it is not called anywhere inside the function below\n\n' + fn.toString())
}

/**
 * Create a chainable method
 *
 * @param {string} api - chainable api name (e.g. chains)
 * @param {string} methodName - name of new chainable method
 * @param {Function} fn - method function
 * @param {Object} methods - private methods collection of a chainable object
 * @param {Array} tasks - private tasks queue of a chainable object
 */
function chainableMethod (api, methodName, fn, methods, tasks) {
  var chainable = this

  // add fn method to private collection methods{}
  methods[methodName] = fn

  // create a public method call
  chainable[methodName] = function (...params) {
    var args = [] // prepare args[] to apply to real methods[methodName]
    for (var arg in arguments) {
      if (arguments.hasOwnProperty(arg)) {
        args[args.length] = arguments[arg]
      }
    }
    // queue the method call
    tasks[tasks.length] = function (done) {
      args[args.length] = done // args = [...params, done]
      methods[methodName].apply(chainable, args) // call method(...params, done)
    }
    chainable[api].exec()
    // return the chain object to make method chaining works
    return chainable
  }
}

/**
 * Validate a chainable method name
 *
 * @param {string} methodName - new chainable method name
 * @param {string} api - chainable object's api name (e.g. chains)
 */
function validateMethod (methodName, api) {
  // check if method name is a string
  if (typeof methodName !== 'string') throw new Error('Method name must be a string')
  // check reserved keyword
  if (methodName === api || methodName.match(/^then$/)) throw new Error('Reserved keyword: ' + methodName)
}

/**
 * Execute queued tasks[0]
 * - then slice item 0
 * - loop until tasks[] empty or an err returned
 *
 * @param {Array} tasks - queued tasks
 * @param {Array} results - tasks' results
 */
function exec (tasks, results) {
  var chains = this

  // tasks' done callback
  var done = function (err, result) {
    if (result !== undefined) results[results.length] = result
    if (err) {
      tasks = [] // nothing more to do
      if (typeof chains.onError !== 'function') throw new Error(err) // application's error handler is expected
      chains.onError(err, results)
      chains.clearResults()
    } else {
      tasks.splice(0, 1)
      if (tasks.length > 0) {
        _exec()
      } else if (typeof chains.onFinished === 'function') {
        chains.onFinished(results)
        chains.clearResults()
      }
    }
  }

  // tasks runner
  var _exec = function () {
    try {
      tasks[0](done)
    } catch (error) {
      throw error
    }
  }

  _exec()
}
