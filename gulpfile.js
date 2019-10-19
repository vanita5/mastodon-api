const gulp = require('gulp')
const eslint = require('gulp-eslint')
const babel = require('gulp-babel')
const clean = require('gulp-clean')

const paths = {
    srcJs: 'src/**/*.js',
    gulpFile: 'gulpfile.js',
    cleanDir: 'lib/',
    destination: 'lib'
}

gulp.task('lint', () => gulp.src([
    paths.srcJs,
    paths.gulpFile
])
    .pipe(eslint())
    .pipe(eslint.format()))

gulp.task('clean', () => gulp.src(paths.cleanDir, { allowEmpty: true, read: false })
    .pipe(clean()))

gulp.task('build', gulp.series('lint', () => gulp.src(paths.srcJs)
    .pipe(babel())
    .pipe(gulp.dest(paths.destination))))

gulp.task('prepublish', gulp.series('clean', 'build'))

gulp.task('default', gulp.series('build'))
