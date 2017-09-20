module.exports = Chainable

/**
 * An object with chainable methods
 *
 * @param {Boolean} checkCallback - set to false to skip callback checking
 *                                when adding new chainable methods
 * @param {Object} customAPI - api names (optional)
 */
function Chainable (checkCallback, customAPI) {
  var defaultAPI = {
    chainable: 'chainable',
    then: 'then',
    done: 'done',
    catch: 'catch',
    results: 'results',
    lastResult: 'lastResult'
  }

  // private variables
  this.__chainable__ = {
    api: defaultAPI,
    methods: {}, // private collection of method functions
    tasks: [], // queue of tasks created from chainable method calls
              // tasks will call real functions in methods {}
    results: [], // results from chained methods call
    executing: 0, // chain execution status
    error: null,
    onError: 'fn', // error handler
    onFinished: 'fn', // done handler
    checkCallback: (checkCallback !== false && checkCallback !== 0) ? 1 : 0
  }

  if ((this instanceof Chainable)) return

  // handle usage of Chainable(customAPI)
  if (checkCallback && checkCallback.constructor === Object) customAPI = checkCallback
  else customAPI = customAPI || {}
  // extend existing object if it's not created from 'new Chainable()'
  for (var key in defaultAPI) {
    if (customAPI.hasOwnProperty(key) && customAPI[key].constructor === String) {
      defaultAPI[key] = customAPI[key]
    }
    // alias the api key to Chainable prototype's function
    this[defaultAPI[key]] = Chainable.prototype[key]
  }
}

/**
 * Register a chainable method
 */
Chainable.prototype.chainable = function (method, fn) {
  // check if method name is a string and not conflict with existing properties name
  if (!method || method.constructor !== String) throw new Error('Method name must be a string')
  if (this[method]) throw new Error('Duplicated method name: ' + method)

  // check if fn is an async function
  checkAsync(fn, 'Method', this.__chainable__.checkCallback)

  // add fn method to private collection methods{}
  this.__chainable__.methods[method] = fn

  // create a public chainable method
  this[method] = function () {
    var args = []
    var l = arguments.length
    for (var i = 0; i < l; i++) {
      args[i] = arguments[i]
    }
    queueTask(this, this.__chainable__.methods[method], args) // queue the method call
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
  var args, i, l

  if (arguments.length === 2 && arguments[1] && arguments[1].constructor === Array) {
    // calling .then( fn(p1, p2, p3, done), [v1, v2, v3] )
    args = arguments[1]
  } else {
    // calling .then( fn(p1, p2, p3, done), v1, v2, v3)
    args = []
    l = arguments.length
    for (i = 1; i < l; i++) {
      args[args.length] = arguments[i]
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
  var chain = this.__chainable__
  chain.onFinished = fn
  // when .done() is called at the end of the chain
  if (!chain.error && chain.executing === 0 && chain.results.length > 0) {
    chain.onFinished(chain.results)
    chain.results = []
  }
  return this
}

/**
 * Handle chains execution error
 * Usage: .catch(function (err, results) {})
 */
Chainable.prototype.catch = function (fn) {
  checkAsync(fn, 'Error handler')
  var chain = this.__chainable__
  chain.onError = fn
  // when .catch() is called at the end of the chain
  if (chain.error && chain.executing === 0) {
    chain.onError(chain.error, chain.results)
    chain.results = []
    chain.error = null
  }
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
 * @param {boolean} checkCallback - set to true to check the fn's source code for a callback
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
 * to be a valid function. No need to checkAsync() here.
 */
function queueTask (chainable, fn, args) {
  var chain = chainable.__chainable__
  chain.tasks[chain.tasks.length] = function (done) {
    if (chain.error) return done()
    args[args.length] = done
    fn.apply(chainable, args) // fn(...params, done)
  }
  // execute tasks
  if (chain.executing === 0) {
    chain.executing = 1
    exec(chain)
  }
}

/**
 * Execute the chain of queued methods
 */
function exec (chain) {
  _exec(chain)

  // tasks' done callback
  function _done (error, result) {
    if (result !== undefined) chain.results[chain.results.length] = result
    if (error) {
      // clear tasks, stop executing
      chain.tasks = []
      chain.executing = 0
      // call onError, or log the error
      if (chain.onError.constructor === Function) {
        chain.onError(error, chain.results)
        chain.results = []
        chain.error = null
      } else {
        chain.error = error
      }
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
    var itodo = chain.executing - 1
    if (itodo > 0) chain.tasks[itodo - 1] = null // clear the previous task
    if (itodo === chain.tasks.length) { // no more tasks to run
      chain.tasks = []
      chain.executing = 0
    } else {
      chain.executing++
      chain.tasks[itodo](_done)
    }
    return chain.executing
  }
}
