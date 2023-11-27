import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { Plugin, PluginBuild } from 'esbuild';

const setup = (build: PluginBuild) => {
	const { initialOptions, onStart } = build;
	const { outfile, outdir } = initialOptions;

	onStart(async () => {
		try {
			if (outfile && existsSync(outfile)) {
				await rm(outfile);
			}

			if (outdir && existsSync(outdir)) {
				await rm(outdir, {
					recursive: true,
				});
			}
		}
		catch (error: unknown) {
			console.error(error);
		}
	});
};

const CleanerPlugin: Plugin = {
	name: 'CleanerPlugin',
	setup,
};

export default CleanerPlugin;
