'use strict';

const request = require('./utils/request');
const queryString = require('querystring');
const cheerio = require('cheerio');
const R = require('ramda');
const scriptData = require('./utils/scriptData');

const PLAYSTORE_URL = 'https://play.google.com/store/apps/details';

function app (opts) {
  return new Promise(function (resolve, reject) {
    if (!opts || !opts.appId) {
      throw Error('appId missing');
    }

    opts.lang = opts.lang || 'en';
    opts.country = opts.country || 'us';

    const qs = queryString.stringify({
      id: opts.appId,
      hl: opts.lang,
      gl: opts.country
    });
    const reqUrl = `${PLAYSTORE_URL}?${qs}`;

    const options = Object.assign({
      url: reqUrl,
      followAllRedirects: true
    }, opts.requestOptions);

    request(options, opts.throttle)
      .then(scriptData.parse)
    // comment next line to get raw data
      .then(scriptData.extractor(MAPPINGS))
      .then(R.assoc('appId', opts.appId))
      .then(R.assoc('url', reqUrl))
      .then(resolve)
      .catch(reject);
  });
}

// TODO may need to do html to text in some of the fields

const MAPPINGS = {
  // FIXME add appId

  title: ['ds:5', 0, 0, 0],
  description: {
    path: ['ds:5', 0, 10, 0, 1],
    fun: descriptionText
  },
  descriptionHTML: ['ds:5', 0, 10, 0, 1],
  summary: ['ds:5', 0, 10, 1, 1],
  installs: ['ds:5', 0, 12, 9, 0],
  minInstalls: {
    path: ['ds:5', 0, 12, 9, 0],
    fun: cleanInt
  },
  score: ['ds:6', 0, 6, 0, 1],
  scoreText: ['ds:6', 0, 6, 0, 0],
  ratings: ['ds:6', 0, 6, 2, 1],
  reviews: ['ds:6', 0, 6, 3, 1],
  histogram: {
    path: ['ds:6', 0, 6, 1],
    fun: buildHistogram
  },

  price: {
    path: ['ds:3', 0, 2, 0, 0, 0, 1, 0, 0],
    fun: (val) => val / 1000000 || 0
  },
  free: {
    path: ['ds:3', 0, 2, 0, 0, 0, 1, 0, 0],
    // considered free only if price is exactly zero
    fun: (val) => val === 0
  },
  currency: ['ds:3', 0, 2, 0, 0, 0, 1, 0, 1],
  priceText: {
    path: ['ds:3', 0, 2, 0, 0, 0, 1, 0, 2],
    fun: priceText
  },
  offersIAP: {
    path: ['ds:5', 0, 12, 12, 0],
    fun: Boolean
  },
  IAPRange: ['ds:5', 0, 12, 12, 0],
  size: ['ds:8', 0],
  androidVersion: {
    path: ['ds:8', 2],
    fun: normalizeAndroidVersion
  },
  androidVersionText: ['ds:8', 2],
  developer: ['ds:5', 0, 12, 5, 1],
  developerId: {
    path: ['ds:5', 0, 12, 5, 5, 4, 2],
    fun: (devUrl) => devUrl.split('id=')[1]
  },
  developerEmail: ['ds:5', 0, 12, 5, 2, 0],
  developerWebsite: ['ds:5', 0, 12, 5, 3, 5, 2],
  developerAddress: ['ds:5', 0, 12, 5, 4, 0],
  privacyPolicy: ['ds:5', 0, 12, 7, 2],
  developerInternalID: ['ds:5', 0, 12, 5, 0, 0],
  genre: ['ds:5', 0, 12, 13, 0, 0],
  genreId: ['ds:5', 0, 12, 13, 0, 2],
  familyGenre: ['ds:5', 0, 12, 13, 1, 0],
  familyGenreId: ['ds:5', 0, 12, 13, 1, 2],
  icon: ['ds:5', 0, 12, 1, 3, 2],
  headerImage: ['ds:5', 0, 12, 2, 3, 2],
  screenshots: {
    path: ['ds:5', 0, 12, 0],
    fun: R.map(R.path([3, 2]))
  },
  video: ['ds:5', 0, 12, 3, 0, 3, 2],
  videoImage: ['ds:5', 0, 12, 3, 1, 3, 2],
  contentRating: ['ds:5', 0, 12, 4, 0],
  contentRatingDescription: ['ds:5', 0, 12, 4, 2, 1],
  adSupported: {
    path: ['ds:5', 0, 12, 14, 0],
    fun: Boolean
  },
  released: ['ds:5', 0, 12, 36],
  updated: {
    path: ['ds:5', 0, 12, 8, 0],
    fun: (ts) => ts * 1000
  },
  version: ['ds:8', 1],
  recentChanges: ['ds:5', 0, 12, 6, 1],
  comments: {
    path: ['ds:16', 0],
    fun: extractComments
  }
};

function descriptionText (description) {
  // preserve the line breaks when converting to text
  const html = cheerio.load('<div>' + description.replace(/<br>/g, '\r\n') + '</div>');
  return cheerio.text(html('div'));
}

function priceText (priceText) {
  // Return Free if the price text is empty
  if (!priceText) {
    return 'Free';
  }
  return priceText;
}

function cleanInt (number) {
  number = number || '0';
  number = number.replace(/[^\d]/g, ''); // removes thousands separator
  return parseInt(number);
}

function normalizeAndroidVersion (androidVersionText) {
  const number = androidVersionText.split(' ')[0];
  if (parseFloat(number)) {
    return number;
  }
  return 'VARY';
}

function buildHistogram (container) {
  if (!container) {
    return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }
  return {
    1: container[1][1],
    2: container[2][1],
    3: container[3][1],
    4: container[4][1],
    5: container[5][1]
  };
}

function extractComments (comments) {
  if (!comments) {
    return [];
  }
  return R.compose(
    R.take(5),
    R.reject(R.isNil),
    R.pluck(4))(comments);
}

module.exports = app;
