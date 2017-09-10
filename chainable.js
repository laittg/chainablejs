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
    addResult: function (r) { results[results.length] = r },

    clearTasks: function () { tasks = [] },
    runTask: function (splice, done) {
      if (splice) tasks.splice(0, 1)
      if (tasks.length === 0) return false
      tasks[0](done)
      return true
    },

    chainable: 'fn',
    queueTask: 'fn',
    exec: 'fn',

    onError: 'fn',
    catch: 'fn',

    onFinished: 'fn',
    done: 'fn',

    parent: 'fn'
  }

  /**
   * Api to register a chainable method,
   * fn is an async function with done(err, result) callback
   */
  chains.chainable = function (methodName, fn) {
    // check if method name is a string and not a reserved keyword
    if (typeof methodName !== 'string') throw new Error('Method name must be a string')
    if (methodName === api || methodName.match(/^then$/)) throw new Error('Reserved keyword: ' + methodName)

    // add fn method to private collection methods{}
    checkAsync(fn)
    methods[methodName] = fn

    // create a public chainable method
    chainableMethod.call(chainable, api, methodName)

    // enable usage of .chainable().chainable()
    return this
  }

  chains.queueTask = function (fn, methodName, args) {
    tasks[tasks.length] = function (done) {
      args[args.length] = done // args = [...params, done]
      typeof fn === 'function'
        ? fn.apply(chainable, args)
        : methods[methodName].apply(chainable, args) // call method(...params, done)
    }
    chains.exec()
  }

  /**
   * Execute the chain of queued methods
   */
  chains.exec = function () {
    if (executing) return
    executing = true
    results = []
    exec.call(this)
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
   * Returns access to parent chainable object when working with chains api
   */
  chains.parent = function () {
    return chainable
  }

  /**
   * Api to chain a custom function fn
   * params will be passed to fn by this structure:
   * .then(
   *   function (p1, p2, p3, done) {
   *     done(err, result)
   *   },
   *   [p1, p2, p3]
   *       -OR-
   *    p1, p2, p3
   * )
   */
  chainable.then = function (fn, ...params) {
    // check if fn is an async function
    checkAsync(fn)

    // prepare args[] to apply to real methods[methodName]
    var args = []
    for (var arg in arguments) {
      if (arg > 0) args[args.length] = arguments[arg]
    }
    // if params are passed by a single array
    if (args.length === 1 && args[0].constructor === Array) args = args[0]

    // queue the custom function call
    chains.queueTask(fn, null, args)

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
 */
function chainableMethod (api, methodName) {
  var chainable = this
  var chains = chainable[api]
  chainable[methodName] = function (...params) {
    var args = [] // prepare args[] to apply to real methods[methodName]
    for (var arg in arguments) {
      if (arguments.hasOwnProperty(arg)) {
        args[args.length] = arguments[arg]
      }
    }
    // queue the method call
    chains.queueTask(null, methodName, args)
    // return the chain object to make method chaining works
    return chainable
  }
}

/**
 * Execute queued tasks[0]
 * - then slice item 0
 * - loop until tasks[] empty or an err returned
 */
function exec () {
  var chains = this

  // tasks' done callback
  var done = function (err, result) {
    if (result !== undefined) chains.addResult(result)
    if (err) {
      chains.clearTasks() // nothing more to do
      if (typeof chains.onError !== 'function') throw new Error(err) // expect error handler
      chains.onError(err, chains.results())
      chains.clearResults()
    } else if (!_exec(true) && typeof chains.onFinished === 'function') {
      // if all tasks executed && there's onFinished()
      chains.onFinished(chains.results())
      chains.clearResults()
    }
    // otherwise: _exec() runs a task, or tasks finished but there's no onFinished() handler
  }

  // tasks runner
  var _exec = function (splice) {
    return chains.runTask(splice, done)
  }

  _exec()
}
