/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2011-2015 Webcomm Pty Ltd
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict';

module.exports = function (config, callback) {

  // Load modules
  var gulp = require('gulp');
  var browserSync = require('browser-sync');
  var del = require('del');
  var mergeStream = require('merge-stream');
  var runSequence = require('run-sequence');
  var tempWrite = require('temp-write');
  var _ = require('underscore');

  // Gulp plugins
  var $ = require('gulp-load-plugins')();

  // Prepare configuration (defaults plus user overrides).
  // See config.example.json for documentation.
  config = _.extend({
    production: false,
    sites: []
  }, config);

  // A list of all available components, mapping any additional assets required.
  // It's a simple way of ensuring only required assets are loaded.
  var availableComponents = {
    'grid':             { javascripts: ['interchange'] },
    'accordion':        { javascripts: ['accordion'] },
    'alert-boxes':      { javascripts: ['alert'] },
    'block-grid':       { javascripts: [] },
    'breadcrumbs':      { javascripts: [] },
    'button-groups':    { javascripts: [] },
    'buttons':          { javascripts: [] },
    'clearing':         { javascripts: ['clearing'] },
    'dropdown':         { javascripts: ['dropdown'] },
    'dropdown-buttons': { javascripts: [] },
    'equalizer':        { javascripts: ['equalizer'] },
    'flex-video':       { javascripts: [] },
    'forms':            { javascripts: ['abide'] },
    'icon-bar':         { javascripts: [] },
    'inline-lists':     { javascripts: [] },
    'joyride':          { javascripts: ['joyride'] },
    'keystrokes':       { javascripts: [] },
    'labels':           { javascripts: [] },
    'magellan':         { javascripts: ['magellan'] },
    'orbit':            { javascripts: ['orbit'] },
    'pagination':       { javascripts: [] },
    'panels':           { javascripts: [] },
    'pricing-tables':   { javascripts: [] },
    'progress-bars':    { javascripts: [] },
    'range-slider':     { javascripts: ['slider'] },
    'reveal':           { javascripts: ['reveal'] },
    'side-nav':         { javascripts: [] },
    'split-buttons':    { javascripts: ['dropdown'] },
    'sub-nav':          { javascripts: [] },
    'switches':         { javascripts: [] },
    'tables':           { javascripts: [] },
    'tabs':             { javascripts: ['tab'] },
    'thumbs':           { javascripts: [] },
    'tooltips':         { javascripts: ['tooltip'] },
    'top-bar':          { javascripts: ['topbar'] },
    'type':             { javascripts: [] },
    'offcanvas':        { javascripts: ['offcanvas'] },
    'visibility':       { javascripts: [] },
  };

  // Components which are required for the boilerplate and must be included at all times
  var requiredComponents = [
    'grid',
    'alert-boxes',
    'breadcrumbs',
    'equalizer',
    'forms',
    'inline-lists',
    'pagination',
    'tables',
    'top-bar',
    'type',
    'visibility'
  ];

  function templatePath(site) {
    return 'app/design/frontend/'+site.package+'/'+site.theme;
  }

  function skinPath(site) {
    return 'skin/frontend/'+site.package+'/'+site.theme;
  }

  // Compile stylesheets for every site
  gulp.task('stylesheets', function () {
    var streams = [];

    _.each(config.sites, function (site) {
      var site = config.sites[0];

      // We're going to create a temporary file for each site, which is a valid
      // SASS stylesheet that defines variables. We'll then prepend this to
      // our SASS compilation so that variables defined in a configuration
      // file can lead to conditional inclusion of components.
      var sassVariables = [];

      // We begin by declaring all of our included components (both required and user-defined)
      _.each(requiredComponents.slice(0).concat(site.components), function (component) {
        sassVariables.push('$include-'+component+'-component: true !default;');
      });

      // We then declare all components are not included, but because of the "!default" flag,
      // these variables are only recognised if they weren't previously defined. This
      // means that we're effectively making sure all the variables are defined
      // so that the SASS file does not error out (see magento-boilerplate.scss)
      _.each(availableComponents, function (noop, component) {
        sassVariables.push('$include-'+component+'-component: false !default;');
      });

      // Create an array of stylesheets
      var stylesheets = [
        tempWrite.sync(sassVariables.join('\n')) // Temporary file made up of concatenated variables
      ];

      // Attach any site-specific stylesheets
      _.each(site.compilation.stylesheets, function (stylesheet) {
        stylesheets.push(stylesheet);
      });

      // Finally, attach the stylesheet in the skin path
      stylesheets.push(skinPath(site)+'/assets/stylesheets/styles.scss');

      // Create an array of default include paths
      var includePaths = [
        'node_modules/magento-boilerplate/node_modules/foundation-sites/scss',
        'node_modules/magento-boilerplate/node_modules/font-awesome/scss',
        'node_modules/magento-boilerplate/assets/stylesheets'
      ];

      // Attach any site-specific include paths
      _.each(site.compilation.includePaths, function (includePath) {
        includePaths.push(includePath);
      });

      // Finally, include the theme's directory in the include paths
      includePaths.push(skinPath(site)+'/assets/stylesheets');

      streams.push(
        gulp
          .src(_.uniq(stylesheets))
          .pipe($.concat('styles.scss'))
          .pipe($.sass({
            outputStyle: config.production ? 'compressed' : 'nested',
            sourceComments: !config.production,
            includePaths: _.uniq(includePaths)
          }))
          .on('error', $.notify.onError())
          .pipe($.autoprefixer('last 2 versions'))
          .pipe(gulp.dest(skinPath(site)+'/css'))
          .pipe(browserSync.stream())
          .pipe($.notify('Compiled Stylesheets.'))
      );
    });

    return mergeStream(streams);
  });

  // JavaScripts
  gulp.task('javascripts', function () {
    var streams = [];

    _.each(config.sites, function (site) {
      var site = config.sites[0];

      // By default, we will load jQuery and the core Foundation library
      var javascripts = [
        'node_modules/magento-boilerplate/node_modules/foundation-sites/js/vendor/jquery.js',
        'node_modules/magento-boilerplate/assets/javascripts/no-conflict.js',
        'node_modules/magento-boilerplate/node_modules/foundation-sites/js/foundation/foundation.js'
      ];

      // Now we will loop through all required components as well as user-defined
      // components to create a list of JavaScripts that we need to include.
      _.each(requiredComponents.slice(0).concat(site.components), function (component) {
        _.each(availableComponents[component].javascripts, function (javascript) {
          javascripts.push('node_modules/magento-boilerplate/node_modules/foundation-sites/js/foundation/foundation.'+javascript+'.js');
        });
      });

      // Now, include any site-specific javascripts
      _.each(site.compilation.javascripts, function (javascript) {
        javascripts.push(javascript);
      });

      // Finally, we'll compile all JavaScripts located in the skin path for the site
      javascripts.push('node_modules/magento-boilerplate/assets/javascripts/magento-boilerplate.js');
      javascripts.push(skinPath(site)+'/assets/javascripts/**/*.js');

      streams.push(
        gulp
          .src(_.uniq(javascripts)) // Avoid duplicates
          .pipe($.concat('scripts.js'))
          .pipe($.if(config.production, $.uglify()))
          .pipe(gulp.dest(skinPath(site)+'/js'))
          .pipe(browserSync.stream())
          .pipe($.notify('Compiled JavaScripts.'))
        );
    });

    return mergeStream(streams);
  });

  // Modernizr is a little different becuase it sits in the head of Magento rather
  // than at the end of hte page
  gulp.task('modernizr', function () {
    var streams = [];

    _.each(config.sites, function (site) {

      streams.push(
        gulp
          .src('node_modules/magento-boilerplate/node_modules/foundation-sites/js/vendor/modernizr.js')
          .pipe($.if(config.production, $.uglify()))
          .pipe(gulp.dest(skinPath(site)+'/js'))
          .pipe(browserSync.stream())
          .pipe($.notify('Compiled Modernizr.'))
      );
    });

    return mergeStream(streams);
  });

  // Images
  gulp.task('images', function () {
    var streams = [];

    _.each(config.sites, function (site) {

      // Build array of images
      var images = [
        'node_modules/magento-boilerplate/assets/images/**/*'
      ];

      // Attach site-specific images
      _.each(site.compilation.images, function (image) {
        images.push(image);
      });

      // Add skin images
      images.push(skinPath(site)+'/assets/images/**/*');

      streams.push(
        gulp
          .src(images)
          .pipe(gulp.dest(skinPath(site)+'/images'))
          .pipe(browserSync.stream({
            once: true
          }))
      );
    });

    return mergeStream(streams);
  });

  gulp.task('fonts', function () {
    var streams = [];

    _.each(config.sites, function (site) {

      var fonts = [
        'node_modules/magento-boilerplate/node_modules/font-awesome/fonts/*.{eot,otf,svg,ttf,woff,woff2}',
        skinPath(site)+'/assets/fonts/*.{eot,otf,svg,ttf,woff,woff2}'
      ];

      streams.push(
        gulp
          .src(fonts)
          .pipe(gulp.dest(skinPath(site)+'/fonts'))
          .pipe(browserSync.stream())
      );
    });

    return mergeStream(streams);
  });

  gulp.task('manifest', function () {
    var streams = [];

    // Because the manifest task actually produces a unique stylesheet and
    // JavaScript file every change, BrowserSync doesn't detect a change
    // with an existing file in the DOM, and therefore won't reload
    // the page or reinject stylesheets, defeating the whole
    // purpose of BrowserSync even being integreated.
    // We'll only generate a manifest on a
    // production environment, which is
    // fine becuase that's the only
    // place it's needed.
    if (config.production) {
      _.each(config.sites, function (site) {
        streams.push(
          gulp
            .src([
              skinPath(site)+'/css/styles.css',
              skinPath(site)+'/js/scripts.js'
            ], {
              base: skinPath(site)
            })
            .pipe($.rev())
            .pipe(gulp.dest(skinPath(site)))
            .pipe($.rev.manifest())
            .pipe(gulp.dest(skinPath(site)))
        );
      });
    }

    return mergeStream(streams);
  });

  // Clean out compiled files synchronously (so errors are not raised in other tasks)
  gulp.task('clean', function () {
    _.each(config.sites, function (site) {
      del.sync([
        skinPath(site)+'/css',
        skinPath(site)+'/fonts',
        skinPath(site)+'/images',
        skinPath(site)+'/js',
        skinPath(site)+'/rev-manifest.json'
      ]);
    });
  });

  // Serve the website with live reloading
  gulp.task('serve', function() {
    _.each(config.sites, function (site) {
      browserSync(site.server);
    });
  });

  // Custom tasks
  gulp.task('custom', function () {
    if (typeof callback === 'function') {
      return callback.apply(this, [gulp]);
    }
  });

  // Our default task will clean and build
  gulp.task('default', ['clean'], function () {
    runSequence(
      ['stylesheets', 'javascripts', 'modernizr', 'images', 'fonts'],
      'manifest',
      'custom'
    );
  });

  // Watching assets will start a build in web server that will
  // automatically synchronise browsers and reload assets
  gulp.task('watch', ['serve'], function () {
    _.each(config.sites, function (site) {

      var stylesheets = [skinPath(site)+'/assets/stylesheets/**/*.scss'];
      _.each(site.watch.stylesheets, function (stylesheet) {
        stylesheets.push(stylesheet);
      });
      gulp.watch(stylesheets, ['stylesheets']);

      var javascripts = [skinPath(site)+'/assets/javascripts/**/*.js'];
      _.each(site.watch.javascripts, function (javascript) {
        javascripts.push(javascript);
      });
      gulp.watch(javascripts, ['javascripts', 'modernizr']);

      var images = [skinPath(site)+'/assets/images/**/*'];
      _.each(site.watch.images, function (image) {
        images.push(image);
      });
      gulp.watch(images, ['images']);

      var others = [templatePath(site)+'/**/*'];
      _.each(site.watch.others, function (other) {
        others.push(other);
      });
      gulp.watch(others, function () {
        browserSync.reload(); // @todo find the new, proper API
      });
    });
  });
};
