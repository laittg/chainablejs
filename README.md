# ChainableJS - Async Chainable Methods

[![Build Status](https://travis-ci.org/laittg/chainablejs.svg?branch=master)](https://travis-ci.org/laittg/chainablejs) [![codecov](https://codecov.io/gh/laittg/chainablejs/branch/master/graph/badge.svg)](https://codecov.io/gh/laittg/chainablejs)

Write Chainable Methods and Avoid Callback Hell in NodeJS / Javascript

## Example

For example you have 3 tasks:

```javascript
function read (topic, time, next) {
  if (time < 100) {
    next(new Error('Not enough time to READ about ' + topic))
  } else {
    setTimeout(function () {
      next(null, 'READ alot about ' + topic)
    }, time)
  }
}

function write (topic, pages, next) {
  // ... lots of effort here
  next(null, 'WROTE ' + pages + ' pages: ' + topic)
}

function zen (time, next) {
  console.log('Zen time... ', time)
  setTimeout(function () {
    next(null, 'Energy recovered!')
  }, time)
}
```

The callback way to do tasks synchronously:

```javascript
read('AI', 1200, function (err, result) {
  // ...
  read('Blockchain', 900, function (err, result) {
    // ...
    write('about Callback Hell', 100, function (err, result) {
      // ...
      zen(500, function (err, result) {
        console.log('Made my day')
      })
    })
  })
})
```

The Chainable Methods Way:

```javascript
var Chainable = require('chainablejs')
var myday = new Chainable()

myday
  // register chainable methods
  .chainable('readAbout', read)
  .chainable('writeBlog', write)
  .chainable('zentime', zen)

  // start execution
  .readAbout('AI', 1200)
  .readAbout('Blockchain', 900)
  .writeBlog('about Callback Hell', 100)
  .zentime(500)

  .done(function (results) {
    console.log(results, 'Made my day')
  })

  // results = [
  //  'READ ... AI',
  //  'READ ... Blockchain',
  //  'WROTE ... Callback Hell,
  //  'Energy recovered!'
  // ]
```

## Api

- then()
- results()
- lastResult()
- catch()
- done()

```javascript
myday
  .writeBlog('about Callback Hell', 100)

  // do something with the last result
  .then(function (next) {
    console.log(myday.lastResult()) // WROTE 100 pages: about Callback Hell
    next()
  })

  .zentime(500)

  // get all the results until now
  .then(function (next) {
    console.log(myday.results())
    // ['WROTE ... Callback Hell, 'Energy recovered!']
    next()
  })

  // catch error
  .catch(function (error, results) {
    console.log(error)
    console.log(results) // results before error occured
  })

  // when all tasks are done
  .done(function (results) {
    console.log(results, 'Made my day')
    // after done() is invoked, myday.results() will return an empty array
  })
```
