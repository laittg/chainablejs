var Chainable = require('../chainable.js')

describe('Chainable', function () {
  var defaultAPI = {
    chainable: 'chainable',
    then: 'then',
    done: 'done',
    catch: 'catch',
    results: 'results',
    lastResult: 'lastResult'
  }

  var customAPI = {
    chainable: 'add',
    then: 'do',
    done: 'done',
    catch: 'catch',
    results: 'getResults',
    lastResult: 'getLastResult'
  }

  function f1 () {}
  function f2 (done) {}
  function f3 (param, done) {
    if (param === 0) {
      done('Error: param is zero')
    } else {
      done(null, param)
    }
  }

  var chain

  beforeEach(function () {
    chain = new Chainable()
  })

  afterEach(function () {
    chain = null
  })

  describe('Initialize', function () {
    it('creates a new Chainable with default settings', function () {
      var chain = new Chainable(customAPI) // passing customAPI won't make sense
      var proto = Object.getPrototypeOf(chain)
      for (var key in defaultAPI) {
        expect(chain.hasOwnProperty(defaultAPI[key])).toBeFalsy()
        expect(proto[key].constructor).toEqual(jasmine.any(Function))
      }
    })

    it('modifies an existing object', function () {
      var chain = {}
      Chainable.call(chain, customAPI) // passing only customAPI should work
      for (var key in customAPI) {
        expect(chain.hasOwnProperty(customAPI[key])).toBeTruthy()
        expect(chain[customAPI[key]].constructor).toEqual(jasmine.any(Function))
      }
      expect(chain[customAPI.chainable].toString()).toEqual(Chainable.prototype.chainable.toString())
    })
  })

  describe('.chainable()', function () {
    it('throws errors', function () {
      expect(function () {
        chain.chainable('then', f1)
      }).toThrowError('Duplicated method name: then')

      expect(function () {
        chain.chainable('think', f1)
      }).toThrowError('There is no callback in the function below\n\n' + f1.toString())

      expect(function () {
        chain.chainable('did', f2)
      }).toThrowError('done' + ' is not a callback, or is not called anywhere inside the function below\n\n' + f2.toString())
    })

    it('not throw callback error when checkCallback === false', function () {
      chain = new Chainable(false)
      expect(function () {
        chain.chainable('think', f1)
      }).not.toThrowError()

      expect(function () {
        chain.chainable('did', f2)
      }).not.toThrowError()
    })

    it('registers a chainable method', function () {
      var chai = chain.chainable('think', f3)
      expect(chain.__chainable__.methods.think.toString()).toEqual(f3.toString())

      var src = chain.think.toString()
      expect(src.indexOf('queueTask(this, this.__chainable__.methods[method], args)'))
        .toBeGreaterThan(1)
      expect(src.indexOf('return this'))
        .toBeGreaterThan(1)

      expect(chai).toEqual(chain)
    })
  })

  describe('.then() - a function with parameter(s)', function () {
    it('throws error when no params are passed', function () {
      expect(function () {
        chain.then(f3)
      }).toThrowError('done is not a function')
    })

    it('throws error when parameters are over loaded', function () {
      expect(function () {
        chain.then(f3, [1, 3, 5])
      }).toThrowError('done is not a function')
    })

    it('log errors, and invoke .catch() when specified', function () {
      chain.then(f3, 0)
      expect(chain.__chainable__.error).toEqual('Error: param is zero')
      expect(chain.__chainable__.executing).toEqual(0)
      chain.catch(function (err, results) {
        expect(err).toEqual('Error: param is zero')
        expect(results).toEqual([])
      })
      expect(chain.__chainable__.error).toBeNull()
    })
  })

  describe('get results', function () {
    it('works', function () {
      chain.then(f3, 1024)
      chain.then(f3, {id: 1024})
      chain.then(f3, [ [1, 3, 5] ])
      expect(chain.lastResult()).toEqual([1, 3, 5])
      expect(chain.results()).toEqual([1024, {id: 1024}, [1, 3, 5]])
      expect(chain.__chainable__.executing).toEqual(0)
    })
  })

  describe('handlers', function () {
    it('handles when done', function (done) {
      chain
        .then(f3, 1024)
        .done(function (results) {
          expect(results).toEqual([1024])
          expect(chain.__chainable__.tasks).toEqual([])
          expect(chain.__chainable__.executing).toEqual(0)
          setTimeout(function () {
            expect(chain.results()).toEqual([])
            done()
          }, 100)
        })
    })

    it('stops when first error returns', function (done) {
      chain
      .then(f3, 1024)
      .then(f3, 0)
      .then(f3, 2048)
      .catch(function (error, results) {
        expect(error).toEqual('Error: param is zero')
        expect(results).toEqual([1024])
        expect(chain.__chainable__.tasks).toEqual([])
        setTimeout(function () {
          expect(chain.results()).toEqual([])
          expect(chain.__chainable__.error).toBeNull()
          done()
        }, 100)
      })
    })
  })

  describe('Completed flow', function () {
    it('works', function (done) {
      function think (topic, time, next) {
        setTimeout(function () {
          next(null, 'Mindset cleared about ' + topic)
        }, time)
      }
      function study (topic, time, next) {
        setTimeout(function () {
          next(null, 'Mastered ' + topic)
        }, time)
      }
      chain
        .chainable('think', think)
        .chainable('study', study)

        .think('AI', 100)
        .then(function (next) {
          expect(chain.lastResult()).toEqual('Mindset cleared about AI')
          next()
        })

        .study('BI', 50)
        .then(function (next) {
          expect(chain.lastResult()).toEqual('Mastered BI')
          next()
        })

        .think('Big Data', 150)
        .then(function (next) {
          expect(chain.lastResult()).toEqual('Mindset cleared about Big Data')
          next()
        })

        .study('Blockchain', 80)
        .then(function (next) {
          expect(chain.lastResult()).toEqual('Mastered Blockchain')
          next()
        })

        .then(function (next) {
          expect(chain.results()).toEqual([
            'Mindset cleared about AI',
            'Mastered BI',
            'Mindset cleared about Big Data',
            'Mastered Blockchain'])
          next()
        })

        .catch(function (error, results) {
          expect(error).not.toBeNull()
          expect(results.lenth).toBeGreaterThan(0)
        })

        .done(function () {
          done()
        })
    })
  })
})
