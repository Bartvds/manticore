module.exports = function (grunt) {
	'use strict';

	require('source-map-support').install();

	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('grunt-ts-clean');
	grunt.loadNpmTasks('grunt-tslint');
	grunt.loadNpmTasks('grunt-dts-bundle');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-shell');

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jshint: {
			options: grunt.util._.extend(grunt.file.readJSON('.jshintrc'), {
				reporter: './node_modules/jshint-path-reporter'
			}),
			support: {
				options: {
					node: true
				},
				src: ['Gruntfile.js', 'tasks/**/*.*.js']
			}
		},
		tslint: {
			options: {
				configuration: grunt.file.readJSON('tslint.json'),
				formatter: 'tslint-path-formatter'
			},
			src: ['src/**/*.ts'],
			test: ['test/src/**/*.ts']
		},
		clean: {
			cruft: [
				'tscommand-*.tmp.txt',
				'dist/.baseDir*',
				'test/tmp/.baseDir*',
				'test/src/.baseDir*'
			],
			dist: [
				'dist/**/*'
			],
			tmp: [
				'tmp/**/*'
			],
			test: [
				'test/tmp/**/*'
			]
		},
		ts: {
			options: {
				fast: 'never',
				target: 'es5',
				module: 'commonjs',
				sourcemap: true,
				comments: true,
				declaration: true
			},
			build: {
				src: ['src/**/*.ts'],
				outDir: 'dist/'
			},
			test: {
				src: ['test/src/**/*.ts'],
				outDir: 'test/tmp/'
			}
		},
		ts_clean: {
			dist: {
				src: ['dist/**/*', '!dist/manticore.d.ts'],
				dot: true
			}
		},
		dts_bundle: {
			index: {
				options: {
					name: 'manticore',
					main: 'dist/index.d.ts',
					removeSource: true
				}
			}
		},
		mochaTest: {
			options: {
				reporter: 'mocha-unfunk-reporter',
				timeout: 18000
			},
			all: {
				src: 'test/tmp/*.test.js'
			}
		},
		shell: {
			scratch_main: {
				options: {
					stderr: false
				},
				command: 'node scratch/main.js'
			}
		}
	});

	grunt.registerTask('prep', [
		'clean',
		'jshint:support'
	]);

	grunt.registerTask('compile', [
		'prep',
		'ts:build',
		'dts_bundle:index',
		'tslint:src'
	]);

	grunt.registerTask('build', [
		'compile',
		'sweep'
	]);

	grunt.registerTask('test', [
		'build',
		'ts:test',
		'mochaTest:all',
		'tslint:test',
		'sweep'
	]);

	grunt.registerTask('run', [
		'mochaTest:all'
	]);

	grunt.registerTask('dev', [
		'ts:test',
		'mochaTest:all',
	]);

	grunt.registerTask('edit_01', [
		'compile',
		'sweep',
		'shell:scratch_main'
	]);

	grunt.registerTask('prepublish', [
		'build',
		'ts:test',
		'tslint:test',
		'ts_clean:dist',
		'sweep',
		'clean:tmp',
		'clean:test'
	]);

	grunt.registerTask('sweep', [
		'clean:cruft'
	]);

	grunt.registerTask('debug', ['build']);

	grunt.registerTask('default', ['build']);
};
