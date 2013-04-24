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
    nodeunit: {
      all: ['test/**/test-*.js']
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
      tasks: ['jshint', 'rig', 'nodeunit']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-rigger');

  grunt.registerTask('test', ['jshint', 'rig', 'nodeunit']);

  grunt.registerTask('default', ['jshint', 'rig', 'uglify', 'nodeunit']);
};
