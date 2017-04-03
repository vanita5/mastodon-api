import gulp from 'gulp'
import eslint from 'gulp-eslint'
import babel from 'gulp-babel'
import clean from 'gulp-clean'

const paths = {
    srcJs: 'src/**/*.js',
    gulpFile: 'gulpfile.babel.js',
    cleanDir: 'lib/',
    destination: 'lib'
}

gulp.task('lint', () =>
    gulp.src([
        paths.srcJs,
        paths.gulpFile
    ])
        .pipe(eslint())
        .pipe(eslint.format())
)

gulp.task('clean', () =>
    gulp.src(paths.cleanDir, { read: false })
        .pipe(clean())
)

gulp.task('build', ['lint'], () =>
    gulp.src(paths.srcJs)
        .pipe(babel())
        .pipe(gulp.dest(paths.destination))
)

gulp.task('prepublish', ['clean', 'build'])

gulp.task('default', ['build'])
