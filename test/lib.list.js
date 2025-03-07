'use strict';

const assert = require('chai').assert;
const assertValidApp = require('./common').assertValidApp;
const validator = require('validator');
const assertValidUrl = require('./common').assertValidUrl;
const gplay = require('../index');

describe('List method', () => {
  const timeout = 15 * 1000;

  it('should throw and error if the given collection does not exist', () => {
    return gplay.list({
      collection: gplay.collection.TRENDING,
      num: 100
    })
      .catch((error) => {
        assert.equal(error.message, 'The collection is invalid for the given category or top apps');
      });
  }).timeout(timeout);

  it('should fetch a valid application list for the free collection', () => {
    return gplay.list({
      collection: gplay.collection.TOP_FREE,
      num: 100
    })
      .then((apps) => apps.map(assertValidApp))
      .then((apps) => apps.map((app) => assert(app.free)));
  }).timeout(timeout);

  it('should fetch a valid application list for the paid collection', () => {
    return gplay.list({
      collection: gplay.collection.TOP_PAID,
      num: 100
    })
      .then((apps) => apps.map(assertValidApp))
      .then((apps) => apps.map((app) => assert.isFalse(app.free)));
  }).timeout(timeout);

  it('should fetch a valid application list for the given category and collection', () => {
    return gplay.list({
      category: gplay.category.GAME_ACTION,
      collection: gplay.collection.TOP_FREE
    })
      .then((apps) => apps.map(assertValidApp))
      .then((apps) => apps.map((app) => assert(app.free)));
  }).timeout(timeout);

  it('should validate the category', () => {
    return gplay.list({
      category: 'wrong',
      collection: gplay.collection.TOP_FREE
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Invalid category wrong'));
  });

  it('should validate the collection', () => {
    return gplay.list({
      category: gplay.category.GAME_ACTION,
      collection: 'wrong'
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Invalid collection wrong'));
  });

  it('should validate the age range', () => {
    return gplay.list({
      category: gplay.category.GAME_ACTION,
      collection: gplay.collection.TOP_FREE,
      age: 'elderly'
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Invalid age range elderly'));
  });

  it('should fetch apps with fullDetail', () => {
    return gplay.list({
      category: gplay.category.GAME_ACTION,
      collection: gplay.collection.TOP_FREE,
      fullDetail: true,
      num: 5
    })
      .then((apps) => apps.map(assertValidApp))
      .then((apps) => apps.map((app) => {
        assert.isNumber(app.minInstalls);
        assert.isNumber(app.reviews);

        assert.isString(app.description);
        assert.isString(app.descriptionHTML);
        assert.isString(app.released);
        assert.isNumber(app.updated);

        assert.equal(app.genre, 'Action');
        assert.equal(app.genreId, 'GAME_ACTION');

        assert.isString(app.version || '');
        assert.isString(app.size || '');
        assert.isString(app.androidVersionText);
        assert.isString(app.androidVersion);
        assert.isString(app.contentRating);

        assert.equal(app.priceText, 'Free');
        assert(app.free);

        assert.isString(app.developer);
        assert.isString(app.developerId);
        if (app.developerWebsite) {
          assertValidUrl(app.developerWebsite);
        }
        assert(validator.isEmail(app.developerEmail), `${app.developerEmail} is not an email`);

        ['1', '2', '3', '4', '5'].map((v) => assert.property(app.histogram, v));
        app.screenshots.map(assertValidUrl);
        app.comments.map(assert.isString);
      }));
  }).timeout(timeout);

  // fetch last page of new paid apps, which have a bigger chance of including
  // results with no downloads (less fields, prone to failures)
  it('It should not fail with apps with no downloads', () =>
    gplay.list({
      category: gplay.category.GAME_ACTION,
      collection: gplay.collection.TOP_PAID,
      num: 20
    })
      .then((apps) => apps.map(assertValidApp)));

  it('It should not fail with apps with no downloads and fullDetail', () =>
    gplay.list({
      category: gplay.category.GAME_ACTION,
      collection: gplay.collection.TOP_FREE,
      num: 10,
      fullDetail: true
    })
      .then((apps) => apps.map(assertValidApp))
  ).timeout(timeout);

  it('should be able to retreive a list for each category', () => {
    const categoryIds = Object.keys(gplay.category);

    const fetchSequentially = (promise, category) => {
      return promise.then(() => {
        return gplay.list({
          category,
          collection: gplay.collection.TOP_FREE,
          num: 10
        })
          .catch(() => {
            assert.equal(category, void 0, 'invalid category');
          });
      });
    };

    return categoryIds.reduce(fetchSequentially, Promise.resolve());
  }).timeout(200 * 1000);
});
