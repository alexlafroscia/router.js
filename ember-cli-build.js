/* eslint-env node */

const path = require('path');
const Funnel = require('broccoli-funnel');
const MergeTrees = require('broccoli-merge-trees');
const Babel = require('broccoli-babel-transpiler');
const Concat = require('broccoli-concat');
const typescript = require('broccoli-typescript-compiler').default;

function findLib(name, libPath) {
  let packagePath = path.join(name, 'package');
  let packageRoot = path.dirname(require.resolve(packagePath));

  libPath = libPath || getLibPath(packagePath);

  return path.resolve(packageRoot, libPath);
}

function getLibPath(packagePath) {
  let packageJson = require(packagePath);

  return path.dirname(packageJson['module'] || packageJson['main']);
}

function toAMD(tree) {
  return new Babel(tree, {
    presets: [
      [
        'env',
        {
          modules: 'amd',
          targets: {
            browsers: ['ie 9'],
          },
        },
      ],
    ],
    resolveModuleSource: require('amd-name-resolver').moduleResolve,
    moduleIds: true,
  });
}

module.exports = function () {
  let ts = 'lib';
  let eslatest = new Funnel(typescript(ts), {
    srcDir: 'lib',
  });

  let amd = toAMD(eslatest);

  let cjs = new Babel(eslatest, {
    presets: [
      [
        'env',
        {
          modules: 'commonjs',
          targets: {
            node: 4,
          },
        },
      ],
    ],
  });

  let trees = [
    new Funnel(eslatest, { srcDir: 'router', destDir: 'modules' }),
    new Funnel(cjs, { srcDir: 'router', destDir: 'cjs' }),
  ];

  let tsTests = typescript('tests');

  let testAMD = toAMD(tsTests);

  let concattedTests = new Concat(testAMD, {
    inputFiles: ['**/*.js'],
    outputFile: 'tests/tests.js',
  });

  let concattedAMD = new Concat(amd, {
    inputFiles: ['**/*.js'],
    // putting this in test to avoid publishing
    outputFile: 'tests/router.amd.js',
  });

  let rsvp = new Funnel(findLib('rsvp'), {
    files: ['rsvp.es.js'],
    getDestinationPath() {
      return 'rsvp.js';
    },
  });
  let rsvpAMD = toAMD(rsvp);

  let rr = new Funnel(findLib('route-recognizer'), {
    files: ['route-recognizer.es.js'],
    getDestinationPath() {
      return 'route-recognizer.js';
    },
  });
  let rrAMD = toAMD(rr);

  let backburner = findLib('backburner.js', 'dist/es6', {
    files: ['backburner.js'],
    annotation: 'backburner es',
  });
  let backburnerAMD = toAMD(backburner);

  let vendorTree = new MergeTrees([rsvpAMD, rrAMD, backburnerAMD]);
  let vendor = new Concat(vendorTree, {
    inputFiles: '**/*.js',
    outputFile: 'vendor/vendor.js',
  });

  trees = trees.concat([
    concattedAMD,

    // dependencies
    new Funnel(findLib('loader.js'), {
      destDir: 'vendor',
      annotation: 'loader.js',
    }),
    new Funnel(findLib('qunit'), {
      files: ['qunit.js', 'qunit.css'],
      destDir: 'vendor',
      annotation: 'qunit',
    }),

    vendor,

    // tests
    new Funnel('tests', {
      files: ['index.html'],
      destDir: 'tests',
    }),

    concattedTests,
  ]);

  return new MergeTrees(trees);
};
