import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';

export default [
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/CCTestSuite.js',
            format: 'umd',
            name: 'CCTestSuite',
            sourcemap: true,
            globals: {},
            exports: 'named'
        },
        treeshake: false,
        plugins: [
            resolve({browser: true, preferBuiltins: false}),
            commonjs({include: /node_modules/, transformMixedEsModules: true}),
            typescript({tsconfig: './tsconfig.json', useTsconfigDeclarationDir: true, clean: true}),
        ],
    },
    {
        input: 'dist/types/src/index.d.ts',
        output: {file: 'dist/CCTestSuite.d.ts', format: 'es'},
        plugins: [dts()],
    },
];
