/* eslint-disable new-cap */

import { build, context, BuildOptions, Plugin } from 'esbuild';
import {
	CleanerPlugin,
	EventSourcePlugin,
	HTMLBuilderPlugin,
} from './config/plugins';

const isProductionEnvironment = process.env.NODE_ENV === 'production';

const entryPoints = [
	'src/App.html',
	'src/App.ts',
	'src/assets/css/App.css',
];
const plugins: Plugin[] = [
	CleanerPlugin,
	HTMLBuilderPlugin((elements) =>
		`<!DOCTYPE html>
	  <html lang="en">
	    <head>
	      <meta charset="UTF-8">
	      <meta name="viewport" content="width=device-width, initial-scale=1.0">
	      ${elements.link}
	    </head>
	    <body>
	      ${elements.div}
	      ${elements.script}
	    </body>
	  </html>`
	),
];

if (!isProductionEnvironment) {
	plugins.splice(1, 0, EventSourcePlugin('/esbuild', '() => location.reload()'));
}

const buildOptions: BuildOptions = {
	entryPoints,
	entryNames: '[name]-[hash]',
	bundle: true,
	splitting: true,
	metafile: true,
	minify: isProductionEnvironment,
	format: 'esm',
	outdir: 'dist',
	outbase: 'src',
	plugins,
	loader: {
		'.html': 'copy',
		'.jpg': 'file',
		'.ttf': 'file',
	},
};

if (isProductionEnvironment) {
	await build(buildOptions);
}
else {
	const { watch, serve } = await context(buildOptions);

	await watch();

	await serve({ servedir: 'dist' });
}
