/*
 * grunt-i18n-js
 * https://github.com/Matthias/grunt-i18n-js
 *
 * Copyright (c) 2014 Matthias Leitner
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  var _    = require('lodash');
  var walk = require('walk');
  var done = null;
  var translations = {};
  var options = {};
  var I18N_AVAILABLE_LOCALES = ['en','de','es','it','nl','fr','cs','ja','pl','pt-br','pt-pt','ru','zh','tr','ko'];

  grunt.registerMultiTask('i18n', 'Convert rails locales to i18n-js compatible js files', function() {
    done = this.async();
    options = this.options({});

    if (!options.railsPath) {
      grunt.fatal('You need to provide the railsPath option!');
    };

    localePaths.call(this);
  });

  function exportLocales(){
    var segments = translationSegments();

    for (var key in segments) {
      if (segments.hasOwnProperty(key)) {
        save(segments[key], key);
      }
    }

    done();
  }

  function save(translationData, filepath){
    var payload  = JSON.stringify(translationData);
    var contents = null;
    filepath = filepath.replace('app/assets/javascripts/', '');
    if(options.saveAsJSON){
      contents = payload;
      filepath = filepath.replace('.js', '.json');
    } else {
      contents = 'var I18n = I18n || {}; \n';
      contents += 'I18n.translations = I18n.translations || {}; \n';
      contents += 'jQuery.extend(true, I18n.translations, ';
      contents += payload;
      contents += ');';
    }

    grunt.log.writeln('Saving to file ' + filepath);
    grunt.file.write(filepath, contents);
  }

  function translationSegments(){
    if(validConfigPresent()) {
      return configuredSegments();
    } else {
      return singleFileExport();
    }
  }

  function validConfigPresent(){
    return (configExists() && config()['translations']);
  }

  function singleFileExport(){
    var segments = {};
    segments[exportDir() + '/translations.js'] = translations;
    return segments;
  }

  function mergeWithFallback(result, locale, scope, fallback){
    var fallbackLoc    = fallbackLocale(fallback);
    var fallbackScope  = scopeWithLocale(scope, fallbackLoc);
    var fallbackResult = scopedTranslations(fallbackScope)

    if(!result[locale]) {
      result[locale] = {};
    }

    result[locale] = _.merge(fallbackResult[fallbackLoc],result[locale]);
  }

  function scopeWithLocale(scope, locale){
    var flatScope = _.flatten([scope]);
    return _.map(flatScope, function(s) { return locale + '.' + s; });
  }

  function scopedTranslations(scopes) {
    var result = {};
    var flatScopes = _.flatten([scopes]);

    flatScopes.forEach(function(scope){
      _.merge(result, filter(translations, scope));
    });

    return result;
  }

  function clone(obj) {
    if(obj == null || typeof(obj) != 'object')
        return obj;

    var temp = obj.constructor(); // changed

    for(var key in obj) {
        if(obj.hasOwnProperty(key)) {
            temp[key] = clone(obj[key]);
        }
    }
    return temp;
  }

  function filter(translationData, scopes) {
    if (typeof scopes == 'string' || scopes instanceof String) {
      scopes = scopes.split('.')
    }

    scopes = clone(scopes);
    var scope = scopes.shift();

    var results = {};

    if (scope === '*') {
      translationData.forEach(function(value, index) {
        var tmp = _.isEmpty(scopes) ? translationData : filter(translationData, scopes);

        if(tmp != null) {
          results[scope] = tmp;
        }
      });
    } else if(translationData[scope]){
      results[scope] = _.isEmpty(scopes) ? translationData[scope] : filter(translationData[scope], scopes);
    };

    return results;
  }

  function fallbackLocale(locale){
    return allLocales().indexOf(locale) > 0 ? locale : 'en';
  }

  function segmentsPerLocale(pattern, scope, fallback){
    var segments = {};

    allLocales().forEach(function(locale){
      var localeScopes = scopeWithLocale(scope, locale);
      var result = scopedTranslations(localeScopes);

      if(fallback) {
        mergeWithFallback(result, locale, scope, fallback);
      }

      if(!_.isEmpty(result)) {
        var segmentName = pattern.replace('%{locale}', locale);
        segments[segmentName] = result;
      }
    });

    return segments;
  }

  function allLocales(){
    return options.locales || I18N_AVAILABLE_LOCALES;
  }

  function configExists(){
    return grunt.file.exists(configFileLocation());
  }

  function configuredSegments(){
    var segments = {};

    config()['translations'].forEach(function(options){
      _.merge({'only':'*', 'fallback': false}, options);

      if (_.include(options['file'], '%{locale}')) {
        var segmentsToMerge = segmentsPerLocale(options['file'],
                                                options['only'],
                                                options['fallback']);

        _.assign(segments, segmentsToMerge);
      } else {
        var result = segmentForScope(options['only']);
        var segmentKey = options['file'];

        if(!_.isEmpty(result)){
          segments[segmentKey] = result;
        }
      }
    });

    return segments;
  }

  function localePaths(){
    var files   = [];
    var walker  = walk.walk(localePath(), { followLinks: false });

    walker.on('file', function(root, stat, next) {
      if(_.includes(stat.name, '.yml')){
        files.push(root + '/' + stat.name);
      }
      next();
    });

    walker.on('end', function() {
      readLocaleFiles(files);
      exportLocales();
    });
  }

  function localePath(){
    var relativeLocalePath = options.localePath || '/app/locales';
    return options.railsPath + relativeLocalePath;
  }

  function segmentForScope(scope){
    if (scope === "*") {
      return translations;
    } else {
      return scopedTranslations(scope);
    };
  }

  function configFileLocation(){
    var configFileName = options.configFile || '/config/i18n-js.yml';
    return options.railsPath + configFileName;
  }

  function readLocaleFiles(paths){
    paths.forEach(function(path){
      readLocaleFile(path);
    });
  }

  function readLocaleFile(path){
    _.merge(translations, grunt.file.readYAML(path));
  }

  function config(){
    return grunt.file.readYAML(configFileLocation());
  }

  function exportDir(){
    return "public/javascripts";
  }
};
