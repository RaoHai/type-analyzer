// Copyright (c) 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

var CONSTANT = require('./constant');
var RegexList = require('./regex-list');

/* eslint-disable max-len*/
/**
* Given an array of regexes to union, build a string of them
* @param {Array} arr - an array of regexes to be unioned
* @return {String} the unioned dstring
*/
function union(arr) {
  return '(' + arr.join('|') + ')';
}

// GENERATE ALL OF THE TIME REGEXES
var HH = '\\d{1,2}';
var H = '\\d{1,2}';
var h = '\\d{1,2}';
var m = '\\d{1,2}';
var s = '\\d{1,2}';
var ss = '\\d{2}';
var SSSS = '(\\.\\d{1,6})';
var mm = '\\d{2}';
var Z = '(\\+|-)\\d{1,2}:\\d{1,2}';
var ZZ = '(\\+|-)(\\d{4}|\\d{1,2}:\\d{2})';
var a = '(am|pm)';

var TIME_FORMAT_STRINGS = [
  'H:m',
  'HH:mmZ',
  'h:m a',
  'H:m:s',
  'h:m:s a',
  'HH:mm:ssZZ',
  'HH:mm:ss.SSSS',
  'HH:mm:ss.SSSSZZ'
].reverse();
// the reverse is important to put the more specific regexs higher in the order
var TIME_FORMAT_REGEX_STRINGS = [
  H + ':' + m,
  HH + ':' + mm + Z,
  h + ':' + m + ' ' + a,
  H + ':' + m + ':' + s,
  H + ':' + m + ':' + s + ' ' + a,
  HH + ':' + mm + ':' + ss + ZZ,
  HH + ':' + mm + ':' + ss + SSSS,
  HH + ':' + mm + ':' + ss + SSSS + ZZ
].reverse();

// something like:
// {'(\d{2)....': 'M-D-YYYY'}
var TIME_FORMAT_REGEX_MAP = TIME_FORMAT_STRINGS
  .reduce(function generateRegexMap(timeFormats, str, index) {
    timeFormats[TIME_FORMAT_REGEX_STRINGS[index]] = str;
    return timeFormats;
  }, {});

var ALL_TIME_FORMAT_REGEX_STR = union(Object.keys(TIME_FORMAT_REGEX_MAP));
var ALL_TIME_FORMAT_REGEX = new RegExp('^' + ALL_TIME_FORMAT_REGEX_STR + '$', 'i');

// GENERATE ALL DATE FORMATS
var YYYY = '\\d{2, 4}';
var M = '\\d{1,2}';
var MMM = union([
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]);
var MMMM = union([
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]);
var D = '\\d{1,2}';
var DD = '\\d{2}';
var Do = '\\d{1,2}(st|nd|rd|th)';

var dateFormatRegexStrings = [
  YYYY + '-' + M + '-' + D,
  M + '\\/' + D + '\\/' + YYYY,
  MMMM + ' ' + DD + ', ' + YYYY,
  MMM + ' ' + DD + ', ' + YYYY,
  MMMM + ' ' + Do + ', ' + YYYY,
  MMM + ' ' + Do + ', ' + YYYY
];
var dateFormatStrings = [
  'YYYY-M-D',
  'M/D/YYYY',
  'MMMM DD, YYYY',
  'MMM DD, YYYY',
  'MMMM Do, YYYY',
  'MMM Do, YYYY'
];
var DATE_FORMAT_REGEX = new RegExp('^' + union(dateFormatRegexStrings) + '$', 'i');

// something like:
// {'(\d{2)....': 'M-D-YYYY'}
var DATE_FORMAT_REGEX_MAP = dateFormatStrings
  .reduce(function generateRegexMap(dateFormats, str, index) {
    dateFormats[dateFormatRegexStrings[index]] = str;
    return dateFormats;
  }, {});

// COMPUTE THEIR CROSS PRODUCT

// {'SOME HELLISH REGEX': 'YYYY HH:MM:SS'}
var DATE_TIME_MAP = Object.keys(DATE_FORMAT_REGEX_MAP)
  .reduce(function reduceDate(dateTimes, dateRegex) {
    var dateStr = DATE_FORMAT_REGEX_MAP[dateRegex];
    Object.keys(TIME_FORMAT_REGEX_MAP).forEach(function loopAcrosTimes(timeRegex) {
      var timeStr = TIME_FORMAT_REGEX_MAP[timeRegex];
      dateTimes[dateRegex + ' ' + timeRegex] = dateStr + ' ' + timeStr;
      dateTimes[dateRegex + 'T' + timeRegex] = dateStr + 'T' + timeStr;
      dateTimes[timeRegex + 'T' + dateRegex] = timeStr + 'T' + dateStr;
      dateTimes[timeRegex + ' ' + dateRegex] = timeStr + ' ' + dateStr;
    });
    return dateTimes;
  }, {});
var ALL_DATE_TIME_REGEX = new RegExp(union(Object.keys(DATE_TIME_MAP)));

/**
* Generate a function to discover which time format a value is
* @param {Regex} formatRegex - the filter to be checked and processed
* @param {Object} regexMap - Map between regex and associated format
* @return {Func} to the format checker
*/
function whichFormatGenerator(formatRegex, regexMap) {
  return function whichFormat(value) {
    if (formatRegex.test(value)) {
      var regexes = Object.keys(regexMap);
      for (var i = 0; i < regexes.length; i++) {
        var regex = regexes[i];
        var format = regexMap[regex];
        var newRegex = new RegExp(regex);
        if (newRegex.test(value)) {
          return format;
        }
      }
    }
    return false;
  };
}

var whichFormatTime = whichFormatGenerator(ALL_TIME_FORMAT_REGEX, TIME_FORMAT_REGEX_MAP);
var whichFormatDate = whichFormatGenerator(DATE_FORMAT_REGEX, DATE_FORMAT_REGEX_MAP);
var whichFormatDateTime = whichFormatGenerator(ALL_DATE_TIME_REGEX, DATE_TIME_MAP);

var Utils = {
  buildRegexCheck: function buildRegexCheck(regexId) {
    return function check(value) {
      return RegexList[regexId].test(value.toString());
    };
  },

  detectTimeFormat: function detectTimeFormat(value, type) {
    switch (type) {
    case CONSTANT.DATA_TYPES.DATETIME:
      return whichFormatDateTime(value);
    case CONSTANT.DATA_TYPES.DATE:
    default:
      return whichFormatDate(value);
    case CONSTANT.DATA_TYPES.TIME:
      return whichFormatTime(value);
    }
  },

  findFirstNonNullValue: function findFirstNonNullValue(data, column) {
    for (var i = 0; i < data.length; i++) {
      if (data[i][column] !== null && data[i][column] !== CONSTANT.NULL) {
        return data[i][column];
      }
    }
    return null;
  },

  isBoolean: function isBoolean(value) {
    return CONSTANT.BOOLEAN_TRUE_VALUES
      .concat(CONSTANT.BOOLEAN_FALSE_VALUES)
      .indexOf(String(value).toLowerCase()) > -1;
  },

  isGeographic: function isGeographic(value) {
    return Boolean(value) && typeof value === 'object' &&
        value.hasOwnProperty('type') && value.hasOwnProperty('coordinates');
  },

  // string types
  isString: function isString(value) {
    return typeof value === 'string';
  },

  whichFormatTime: whichFormatGenerator(ALL_TIME_FORMAT_REGEX, TIME_FORMAT_REGEX_MAP),
  whichFormatDate: whichFormatGenerator(DATE_FORMAT_REGEX, DATE_FORMAT_REGEX_MAP),
  whichFormatDateTime: whichFormatGenerator(ALL_DATE_TIME_REGEX, DATE_TIME_MAP)
};

/* eslint-enable max-len*/

module.exports = Utils;
