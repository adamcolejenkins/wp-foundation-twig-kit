'use strict';

import plugins from 'gulp-load-plugins';
import yargs from 'yargs';
import browser from 'browser-sync';
import gulp from 'gulp';
import panini from 'panini';
import rimraf from 'rimraf';
import sherpa from 'style-sherpa';
import yaml from 'js-yaml';
import fs from 'fs';

// Load all Gulp plugins into one variable
const $ = plugins();

// Check for --production flag
const PRODUCTION = !!( yargs.argv.production );

// Load settings from settings.yml
const {
  COMPATIBILITY,
  PORT,
  PROXY,
  UNCSS_OPTIONS,
  PATHS,
  THEME
} = loadConfig();

function loadConfig() {
  let ymlFile = fs.readFileSync( 'config.yml', 'utf8' );
  return yaml.load( ymlFile );
}

// Build the "dist" folder by running all of the below tasks
gulp.task( 'build',
  gulp.series( clean, gulp.parallel( theme, sass, javascript, images, copy ), styleGuide ) );

// Build the site, run the server, and watch for file changes
gulp.task( 'default',
  gulp.series( 'build', server, watch ) );

// Delete the "dist" folder
// This happens every time a build starts
function clean( done ) {
  rimraf( PATHS.dist, done );
}

// Copy files out of the assets folder
// This task skips over the "img", "js", and "scss" folders, which are parsed separately
function copy() {
  return gulp.src( PATHS.assets )
    .pipe( gulp.dest( PATHS.dist + '/assets' ) );
}

// TODO: Consider whether this is necessary
// Generate a style guide from the Markdown content and HTML template in styleguide/
function styleGuide( done ) {
  sherpa( 'src/styleguide/index.md', {
    output: PATHS.dist + '/styleguide.html',
    template: 'src/styleguide/template.html'
  }, done );
}

// Copy themes to dist, Gulp won't be doing anything with these files.
function theme() {
  return gulp.src( PATHS.theme )
    .pipe( gulp.dest( PATHS.dist ) );
}

// Compile Sass into CSS
// In production, the CSS is compressed
function sass() {
  return gulp.src( 'src/assets/scss/style.scss' )
    .pipe( $.sourcemaps.init() )
    .pipe( $.sass( {
        includePaths: PATHS.sass
      } )
      .on( 'error', $.sass.logError ) )
    .pipe( $.autoprefixer( {
      browsers: COMPATIBILITY
    } ) )
    // Comment in the pipe below to run UnCSS in production
    .pipe( $.if( PRODUCTION, $.uncss( UNCSS_OPTIONS ) ) )
    .pipe( $.if( PRODUCTION, $.cssnano() ) )
    .pipe( $.if( !PRODUCTION, $.sourcemaps.write() ) )
    .pipe( gulp.dest( PATHS.dist ) )
    .pipe( browser.reload( {
      stream: true
    } ) );
}

// Combine JavaScript into one file
// In production, the file is minified
function javascript() {
  return gulp.src( PATHS.javascript )
    .pipe( $.sourcemaps.init() )
    .pipe( $.babel() )
    .pipe( $.concat( 'app.js' ) )
    .pipe( $.if( PRODUCTION, $.uglify()
      .on( 'error', e => {
        console.log( e );
      } )
    ) )
    .pipe( $.if( !PRODUCTION, $.sourcemaps.write() ) )
    .pipe( gulp.dest( PATHS.dist + '/assets/js' ) );
}

// Copy images to the "dist" folder
// In production, the images are compressed
function images() {
  return gulp.src( 'src/assets/img/**/*' )
    .pipe( $.if( PRODUCTION, $.imagemin( {
      progressive: true
    } ) ) )
    .pipe( gulp.dest( PATHS.dist + '/assets/img' ) );
}

// Start a server with BrowserSync to preview the site in
function server( done ) {
  browser.init( {
    // server: PATHS.dist,
    port: PORT,
    proxy: PROXY,
    open: false,
    notify: false
  } );
  done();
}

// Reload the browser with BrowserSync
function reload( done ) {
  browser.reload();
  done();
}

// Watch for changes to static assets, theme, Sass, and JavaScript
function watch() {
  gulp.watch( PATHS.assets, copy );
  gulp.watch( 'src/**/*.{php,twig}' )
    .on( 'change', gulp.series( theme, browser.reload ) );
  gulp.watch( 'src/assets/scss/**/*.scss', sass );
  gulp.watch( 'src/assets/js/**/*.js' )
    .on( 'change', gulp.series( javascript, browser.reload ) );
  gulp.watch( 'src/assets/img/**/*' )
    .on( 'change', gulp.series( images, browser.reload ) );
  gulp.watch( 'src/styleguide/**' )
    .on( 'change', gulp.series( styleGuide, browser.reload ) );
}
