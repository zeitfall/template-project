import { readFile } from 'fs/promises';
import { transform, Plugin, PluginBuild, OnLoadResult } from 'esbuild';

const getEventSourceScript = (url: string, callback: string) =>
	`new EventSource('${url}').addEventListener('change', ${callback});\n`;

const setup = (eventUrl: string, eventCallback: string, build: PluginBuild) => {
	const { initialOptions, onLoad, onEnd } = build;
	const { entryPoints } = initialOptions;

	if (!(entryPoints instanceof Array) || !entryPoints.length) {
		return;
	}

	let isAlreadyInjected = false;

	const eventSourceScript = getEventSourceScript(eventUrl, eventCallback);

	onLoad({ filter: /.ts$/ }, async ({ path }) => {
		const result: OnLoadResult = {};

		const currentEntryPoint = entryPoints.find((entryPoint) => {
			if (typeof entryPoint === 'string') {
				return path.includes(entryPoint);
			}

			return path.includes(entryPoint.in);
		});

		if (!currentEntryPoint || isAlreadyInjected) {
			return result;
		}

		try {
			isAlreadyInjected = true;

			const filePath = typeof currentEntryPoint === 'string'
				? currentEntryPoint
				: currentEntryPoint.in;
			const initialFileContent = await readFile(filePath, { encoding: 'utf8' });
			const { code: transformedFileContent } = await transform(eventSourceScript + initialFileContent, { loader: 'ts' });

			result.contents = transformedFileContent;
		}
		catch (error: unknown) {
			isAlreadyInjected = false;

			console.error(error);
		}

		return result;
	});

	onEnd(() => {
		isAlreadyInjected = false;
	});
};

const EventSourcePlugin = (url: string, callback: string): Plugin => ({
	name: 'EventSourcePlugin',
	setup: setup.bind(setup, url, callback),
});

export default EventSourcePlugin;
