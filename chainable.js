module.exports = Chainable

/**
 * An object with chainable methods
 *
 * @param {Object} api - api names (optional)
 */
function Chainable (api) {
  var _api = {
    chainable: 'chainable',
    then: 'then',
    done: 'done',
    catch: 'catch',
    results: 'results',
    lastResult: 'lastResult'
  }

  // private variables
  this.__chainable__ = {
    api: _api,
    methods: {}, // private collection of method functions
    tasks: [], // queue of tasks created from chainable method calls
              // tasks will call real functions in methods {}
    results: [], // results from chained methods call
    executing: false, // chain execution status
    onError: 'fn', // error handler
    onFinished: 'fn' // done handler
  }

  // extend existing object
  if (!(this instanceof Chainable)) {
    api = api || {}
    for (var key in _api) {
      if (api.hasOwnProperty(key) && api[key] && api[key].constructor === String) {
        _api[key] = api[key] // e.g manual set .controller() instead of .chainable()
      }
      this[_api[key]] = Chainable.prototype[key]
    }
  }
}

/**
 * Register a chainable method
 */
Chainable.prototype.chainable = function (method, fn) {
  // check if method name is a string and not a reserved keyword
  if (!method || method.constructor !== String) throw new Error('Method name must be a string')
  if (this.__chainable__.api.hasOwnProperty(method)) throw new Error('Reserved keyword: ' + method)

  // add fn method to private collection methods{}
  checkAsync(fn, 'Method', true)
  this.__chainable__.methods[method] = fn

  // create a public chainable method
  this[method] = function (...params) {
    queueTask(this, this.__chainable__.methods[method], arguments) // queue the method call
    return this // enable methods chaining .methodA().methodB()
  }

  return this
}

/**
 * Api to chain a custom function fn
 * params will be passed to fn by this structure:
 * .then(
 *   function fn (p1, p2, p3, done) {
 *     done(err, result) // callback is optional for .then
 *   },
 *   [p1, p2, p3]
 *       -OR-
 *    p1, p2, p3
 * )
 *
 * Note: if fn(hasOnlyP1, done) and P1 takes an array V1[] as value,
 * then the calling structure must be: .then(fn, [ V1[] ])
 */
Chainable.prototype.then = function (fn) {
  // check if fn is an async function
  checkAsync(fn, 'Then handler')

  // prepare args[] to apply to real methods[methodName]
  var args, i

  if (arguments.length === 2 && arguments[1] && arguments[1].constructor === Array) {
    // calling .then( fn(p1, p2, p3, done), [v1, v2, v3] )
    args = arguments[1]
    // if fn has only one param and it takes an array
    //   call .then( fn(p1, done), [ [v1.1, v1.2, v1.3] ])
  } else {
    // calling .then( fn(p1, p2, p3, done), v1, v2, v3)
    args = []
    for (i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i]
    }
  }

  // queue the custom function call
  queueTask(this, fn, args)

  return this
}

/**
 * Handle when chains execution finished successfully
 * Usage: .done(function (results) {})
 */
Chainable.prototype.done = function (fn) {
  checkAsync(fn, 'Done handler')
  this.__chainable__.onFinished = fn
  return this
}

/**
 * Handle chains execution error
 * Usage: .catch(function (err, results) {})
 */
Chainable.prototype.catch = function (fn) {
  checkAsync(fn, 'Error handler')
  this.__chainable__.onError = fn
  return this
}

/**
 * Get all results[]
 */
Chainable.prototype.results = function () {
  return this.__chainable__.results
}

/**
 * Get the last result
 */
Chainable.prototype.lastResult = function () {
  var results = this.__chainable__.results
  return results[results.length - 1]
}

// HELPERS
// =======================================================================

/**
 * Check if fn is an async function
 * - should has at least one parameter which is a callback function
 * - should call the callback function
 *
 * @param {Function} fn - an async function (...params, done)
 * @param {string} desc - description of fn, e.g. Error handler
 * @param {boolean} checkCallback - set to true to check fn source for callback
 */
function checkAsync (fn, desc, checkCallback) {
  if (!fn || fn.constructor !== Function) throw new Error(desc + ' is not a function: ' + fn)
  if (!checkCallback) return

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
  if (!cb.test(src)) throw new Error(lastparam + ' is not a callback, or is not called anywhere inside the function below\n\n' + fn.toString())
}

/**
 * Queue an async function or a method call with arguments.
 * By calling internally, fn is guaranteed
 * to be a valid function
 */
function queueTask (chainable, fn, args) {
  var tasks = chainable.__chainable__.tasks
  tasks[tasks.length] = function (done) {
    args[args.length] = done
    fn.apply(chainable, args) // fn(...params, done)
  }
  // execute tasks
  if (!chainable.__chainable__.executing) exec(chainable.__chainable__)
}

/**
 * Execute the chain of queued methods
 */
function exec (chain) {
  if (chain.executing) return

  // chain.results = []
  // if the chain has no done callback, results will not be cleared

  // tasks' done callback
  function _done (err, result) {
    if (result !== undefined) chain.results[chain.results.length] = result
    if (err) {
      // error-first
      if (chain.onError.constructor !== Function) throw new Error(err) // expect error handler
      chain.onError(err, chain.results)
      chain.tasks = [] // nothing more to do
      chain.results = []
      chain.executing = false
    } else if (_exec(chain)) {
      // has tasks to run, do nothing here
    } else if (chain.onFinished.constructor === Function) {
      // all tasks executed && there's onFinished()
      chain.onFinished(chain.results)
      chain.results = []
    } else {
      // tasks finished but there's no onFinished() handler, do nothing
    }
  }

  // tasks runner; passing chain param for performance optimization
  function _exec (chain) {
    chain.executing
      ? chain.tasks.shift()
      : chain.executing = true
    if (chain.tasks.length === 0) {
      chain.executing = false
      return false
    } else {
      chain.tasks[0](_done)
      return true
    }
  }

  _exec(chain)
}
