# sequelize-embed

[![npm version](https://badge.fury.io/js/sequelize-embed.svg)](https://www.npmjs.com/package/sequelize-embed)
[![Build Status](https://travis-ci.org/Wsiegenthaler/sequelize-embed.svg?branch=master)](https://travis-ci.org/Wsiegenthaler/sequelize-embed)
[![dependencies Status](https://david-dm.org/wsiegenthaler/sequelize-embed/status.svg)](https://david-dm.org/wsiegenthaler/sequelize-embed)
[![Coverage Status](https://coveralls.io/repos/github/Wsiegenthaler/sequelize-embed/badge.svg?branch=master)](https://coveralls.io/github/Wsiegenthaler/sequelize-embed?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/wsiegenthaler/sequelize-embed/badge.svg)](https://snyk.io/test/github/wsiegenthaler/sequelize-embed)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FWsiegenthaler%2Fsequelize-embed.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FWsiegenthaler%2Fsequelize-embed?ref=badge_shield)

*Easily insert and update sequelize models with deeply nested associations*

While Sequelize will retrieve nested assocations via the `include` option, it does not provide the ability to write them. This module allows for easy synchronization of nested associations by recursively inserting new, updating existing, or deleting removed association values.

* Synchronizes nested associations in a single atomic operation
* Prunes redundant foreign keys and later infers them
* Works with optimistic locking in *Sequelize v4*
* Includes *Epilogue* middleware for document-oriented PUT/POST

# API

### Operations

#### `insert(model, values, include, options)`

Inserts a new record given `values` and synchronizes nested associations specified by `include`.

#### `update(model, values, include, options)`

Updates the record corresponding to `values` and synchronizes nested associations specified by `include`.

### Parameters

#### model

The sequelize model of the root of the structure.

#### values

Object representing the values to be written, including any nested structure.

#### include

Array specifying the nested associations to be embedded. The `include` parameter is recursive and is usually a subset of those passed to `Model.findById/One/All`.

#### options

> ##### transaction
>
> The transaction to be used. When provided, invoking `commit` or `rollback` is the resonsibility of the caller. Otherwise, a transaction will be created automatically and committed when done.
>
> ##### reload
>
> Whether to reload and return the full instance after success. May also be an object specifying further options:
> >
> > ##### include
> >
> > The nested associations to be read and returned. Defaults to the `include` parameter used in the write.
> >
> > ##### plain
> > 
> > Return plain object instead of Sequelize instances. (default `true`)
> > 
> > ##### prune
> > 
> > Whether to prune redundant foreign keys. (default `true`)

# Getting Started

### Install

```javascript
npm install --save sequelize-embed
```

### Basic Example

Import `sequelize-embed` and initialize with `sequelize`:

```javascript
const embed = require('sequelize-embed')(sequelize)
```

Setup an example schema - an *Order* can have *Items*, each of which is assigned a *Department*:

```javascript
const Order = sequelize.define('Order', {})
const Item = sequelize.define('Item', { quantity: Sequelize.STRING })
const Department = sequelize.define('Department', { name: Sequelize.STRING })

Order.Items = Order.hasMany(Item, { as: 'items', foreignKey: 'orderId' })
Item.Department = Item.belongsTo(Department, { as: 'department', foreignKey: 'deptId' })`
```

Use the `mkInclude` helper to define the associations we wish to include. Here `itemsOnly` will update `Items` while `itemsAndDept` will update `Items` *and* `Departments`.

```javascript
const { mkInclude } = embed.util.helpers

const itemsAndDept = [ mkInclude(Order.Items, mkInclude(Item.Department)) ]
const itemsOnly = [ mkInclude(Order.Items) ]
```

Insert an order, it's items, and departments by including `itemsAndDept`:

```javascript
const order = {
  items: [ { quantity: 1, department: { name: 'produce' } } ]
}

embed.insert(Order, order, itemsAndDept)

// id: 1,
// items: [ { id: 1, quantity: '1', department: { id: 1, name: 'produce' } } ]
```

Change the quantity and department of our existing item:

```javascript
const order = {
  id: 1,
  items: [ { id: 1, quantity: 2, department: { name: 'dairy' } } ]
}

embed.update(Order, order, itemsAndDept)

// id: 1,
// items: [ { id: 1, quantity: '2', department: { id: 2, name: 'dairy' } } ]
```

For the purposes of demonstration we've included `Departments` in our update, but since a `Department` is shared between orders we probably wouldn't want to include them when updating an order. Let's add another item, this time including just `itemsOnly` and being sure to specify a department known to exist:

```javascript
const order = {
  id: 1,
  items: [
    { id: 1, quantity: 2, department: { id: 2, name: 'dairy' } },
    { quantity: 3, department: { id: 1 } } ]
}

embed.update(Order, order, itemsOnly, { reload: { include: itemsAndDept } })

// id: 1,
// items: [
//   { id: 1, quantity: '2', department: { id: 2, name: 'dairy' } },
//   { id: 2, quantity: '3', department: { id: 1, name: 'produce' } } ]
```
Notice that the new item was correctly assigned to the `produce` department despite `Departments` not being included in the update. Since *belongs to* foreign keys are on the source, they are always mapped back from any embedded values, even if a value isn't included for update itself. Also, we now pass `itemsAndDept` as the `reload.include` option which will include the `department` field in the result despite it not being updated.

Finally, remove the first item and reassign the second to the `dairy` department:

```javascript
const order = {
  id: 1,
  items: [ { id: 2, quantity: 3, department: { id: 2 } } ]
}

embed.update(Order, order, itemsOnly, { reload: { include: itemsAndDept } })

// id: 1,
// items: [
//   { id: 2, quantity: '3', department: { id: 2, name: 'dairy' } } ]
```

### Performance

Since the underlying data is normalized, completing an `update` or `insert` operation requires many reads and writes to synchronize the entire structure. For applications where performance is critical, be sure to restrict the total number of embedded associations and only embed those with reasonably low-cardinality.

# Epilogue Middleware


*Sequelize Embed* also provides *Epilogue* middleware for automatically updating associations during PUT and POST operations. This can greatly simplify client development by giving your REST api the feel of a document-oriented database.

```javascript
const embed = require('sequelize-embed')(sequelize)

const includeOnRead = ...  // include for get
const includeOnWrite = ... // include for put/post

// setup resource like normal
const resource = epilogue.resource({
  model: Model,
  include: includeOnRead,
  associations: false,
  ...
});

// add middleware to the resource, specifying includes
const middleware = embed.Epilogue(epilogue)
resource.use(middleware(includeOnWrite))
```

## License

Everything in this repo is BSD License unless otherwise specified

sequelize-embed (c) 2017 Weston Siegenthaler


[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FWsiegenthaler%2Fsequelize-embed.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FWsiegenthaler%2Fsequelize-embed?ref=badge_large)