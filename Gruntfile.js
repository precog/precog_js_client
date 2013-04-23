module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'dist/<%= pkg.name %>.js',
        dest: 'dist/<%= pkg.name %>.min.js'
      }
    },
    'node-qunit': {
      all: {
        code: {
          path: 'dist/precog-js-client.js',
          namespace: 'Precog'
        },
        tests: 'test/test-api.js'
      }
    },
    qunit: {
      files: ['test/**/*.html'],
      
      options: {
        timeout: 10000
      }
    },
    jshint: {
      files: ['gruntfile.js', 'src/*.js', 'test/**/*.js'],
      options: {
        // options here to override JSHint defaults
        eqnull: true,
        expr: true,

        globals: {
          console: true,
          module: true,
          document: true
        }
      }
    },
    rig: {
      compile: {
        files: {
          'dist/<%= pkg.name %>.js': ['src/precog-rigger.js']
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['jshint', 'rig', 'qunit']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-node-qunit');
  grunt.loadNpmTasks('grunt-rigger');

  grunt.registerTask('test', ['jshint', 'rig', 'node-qunit', 'qunit']);

  grunt.registerTask('default', ['jshint', 'rig', 'uglify', 'qunit']);
};
