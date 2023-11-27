import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { Plugin, PluginBuild } from 'esbuild';

type HTMLBuilderElements = keyof HTMLElementTagNameMap;

type HTMLBuilderEntries = keyof Pick<HTMLElementTagNameMap, 'link' | 'script' | 'div'>;

type HTMLBuilderTemplates = Record<HTMLBuilderEntries, (...args: unknown[]) => string>;

type HTMLBuilderEntryCallback = (entry: [HTMLBuilderEntries, string[]]) => void;

type HTMLBuilderBuildCallback = (entries: Record<HTMLBuilderEntries, string>) => string;

interface HTMLBuilderConfiguration {
	entries: Partial<Record<HTMLBuilderEntries, string[]>>;
}

class HTMLBuilder {
	public readonly elements = {} as Record<HTMLBuilderElements, string>;

	protected readonly templates = {
		link: (filePath: string) => `<link rel="stylesheet" href="${filePath}">`,
		script: (filePath: string) => `<script type="module" src="${filePath}" defer></script>`,
		div: (content: string) => content,
	} as HTMLBuilderTemplates;

	constructor(
		protected readonly configuration: HTMLBuilderConfiguration
	) {
		const entryCallback: HTMLBuilderEntryCallback = (entry) => {
			const [element, paths] = entry;

			this.elements[element] = paths.reduce((templates, filePath) => {
				const elementTemplate = this.templates[element];

				if (typeof elementTemplate === 'function') {
					return `${templates  }${elementTemplate(filePath)}\n`;
				}

				return templates;
			}, '');
		};

		const configurationEntries =
      Object.entries(this.configuration.entries) as Array<[HTMLBuilderEntries, string[]]>;

		configurationEntries.forEach(entryCallback);
	}

	public build(callback: (elements: Record<HTMLBuilderElements, string>) => string): string {
		return callback(this.elements);
	}
}

const splitFiles = (files: string[], extension: string) => {
	const regexpPattern = new RegExp(`.*${extension}$`);

	return files.reduce((splittedFiles, file) => {
		if (!file || !regexpPattern.test(file)) {
			return splittedFiles;
		}

		return splittedFiles.concat(file);
	}, [] as string[]);
};

const name = 'HTMLBuilderPlugin';

const setup = (buildCallback: HTMLBuilderBuildCallback, build: PluginBuild) => {
	const { initialOptions, onEnd } = build;
	const { entryPoints, outdir } = initialOptions;

	if (!outdir) {
		return;
	}

	const normalizedEntryPoints = Object.values(entryPoints ?? [])
		.reduce((accumulator, entryPoint) => {
			if (typeof entryPoint === 'string') {
				accumulator.push(entryPoint);
			}

			if (typeof entryPoint === 'object') {
				accumulator.push(entryPoint.in);
			}

			return accumulator;
		}, []) as string[];

	onEnd(async ({ metafile }) => {
		try {
			if (!metafile) {
				throw new Error(`[${name}]: Metafile is not specified.`);
			}

			const { outputs } = metafile;
			const outputFiles = Object.entries(outputs)
				.reduce((files, output) => {
					const [outputFilePath, outputFileData] = output;
					const outputFile = path.relative(outdir, outputFilePath);

					const isRelativeInputFileExist =
						outputFileData.entryPoint && normalizedEntryPoints.includes(outputFileData.entryPoint) ||
						normalizedEntryPoints.includes(Object.keys(outputFileData.inputs).pop() ?? '');

					if (isRelativeInputFileExist) {
						files.push(outputFile);
					}

					return files;
				}, [] as string[]);

			const styleFiles = splitFiles(outputFiles, '.css');
			const scriptFiles = splitFiles(outputFiles, '.js');
			const htmlFiles = splitFiles(outputFiles, '.html')
				.map((file) => readFile(path.resolve(outdir, file), { encoding: 'utf8' }));

			const builder = new HTMLBuilder({
				entries: {
					link: styleFiles,
					script: scriptFiles,
					div: await Promise.all(htmlFiles),
				},
			});

			await writeFile(path.resolve(outdir, 'index.html'), builder.build(buildCallback));
		}
		catch (error: unknown) {
			console.error(error);
		}
	});
};

const HTMLBuilderPlugin = (callback: HTMLBuilderBuildCallback): Plugin => ({
	name,
	setup: setup.bind(setup, callback),
});

export default HTMLBuilderPlugin;
