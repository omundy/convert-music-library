/**
 * 	Converts an entire iTunes library to MP3, maintaining original folder structure
 * 	- Copies file if format matches
 *  - @author Owen Mundy owenmundy.com
 */

const importPath = "/Volumes/TREK-MusicBackup/music-drive-to-convert",
	exportPath = "/Volumes/TREK-MusicBackup/music-drive-converted",
	convertToType = ".mp3";

import { readdir, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import * as path from 'path';

import { exec } from "node:child_process";
import util from "node:util";
// promisify exec
const execPromise = util.promisify(exec);



let count = 0;
const main = async () => {

	// 1. get all files, flattened
	const allFiles = await walk(importPath);
	// console.log(allFiles)

	try {
		// 2. loop through all
		for (const file of allFiles.flat(Number.POSITIVE_INFINITY)) {
			++count;

			// 3. parse path
			let p = path.parse(file);
			console.log(`${count}. ${p.dir} >>> ${p.name} ^^^ ${p.ext}`);

			// 4. create dir if needed
			await checkAndMakeDirectory(exportPath + p.dir)

			// 5. create ffmpeg or copy command
			let cmd = 'ls -la';

			if (p.ext.toLowerCase() == convertToType) {
				cmd = `cp "${importPath + file}" "${exportPath + file}";`
			} else if (convertToType == ".mp3") {
				// -y = overwrite; -c:a libmp3lame = reencode using mp3 audio codec; -q:a 4 = set quality to 6 (out of 10)
				cmd = `ffmpeg -y -i "${importPath + file}" -c:a libmp3lame -q:a 6 "${exportPath + p.dir + "/" + p.name + ".mp3"}";`
			} else if (convertToType == ".wav") {
				cmd = `ffmpeg -y -i "${importPath + file}" "${exportPath + p.dir + "/" + p.name + ".wav"}";`
			}
			// console.log(cmd);


			// 6. convert songs (3 options)

			// a. very slow conversion, waits until each song finishes
			// await runCommand(cmd); 

			// b. convert all concurrently, will test your computer's fan!
			runCommand(cmd); 
			// optional: pace the conversion, waits n seconds every 10 songs
			if (count > 1 && count % 10 == 0) await wait(3000);


			// if (count > 100) return; // enable to exit early for testing
		}
		console.log(`Converted ${count} `);
	} catch (e) {
		throw e;
	}
};


////////////////////////////////////////////////////////////
/////////////////////// FUNCTIONS //////////////////////////
////////////////////////////////////////////////////////////

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 	Run shell command async 
 * 	modified from https://stackoverflow.com/a/70742322/441878
 */
async function runCommand(cmd = 'ls -l') {
	try {
		const { stdout, stderr } = await execPromise(cmd);
		// if (stdout)
		// 	console.log('stdout:', stdout);
		if (stderr)
			console.error('stderr:', stderr); // stderr is usually for errors, but can contain other output
	} catch (error) {
		console.error('Command execution failed:', error);
		console.error('stdout:', error.stdout); // Access stdout/stderr from error object if command failed
		console.error('stderr:', error.stderr);
	}
}

/**
 * 	Get recursive directory list
 * 	modified from https://stackoverflow.com/a/71166133/441878 
 * 	1. Hierarchical: await walk(importPath)
 * 	2. Flat: await walk(importPath).flat(Number.POSITIVE_INFINITY)
 */
const walk = async (dirPath) => Promise.all(
	await readdir(dirPath, { withFileTypes: true })
		.then((entries) => entries.filter((entry) => !ignoreFiles(entry.name))) // skip
		.then((entries) => entries.map((entry) => {
			const childPath = join(dirPath, entry.name);
			if (entry.isDirectory())
				return walk(childPath);
			else
				return childPath.replace(importPath, "");
		})),
)

/**
 *	Create directory if doesn't exist
 */
async function checkAndMakeDirectory(dir) {
	try {
		let stats = await stat(dir);
		// console.log("stats", stats);
	} catch (error) {
		if (error.code === "ENOENT") {
			try {
				// recursive: true creates parent directories if they don't exist
				await mkdir(dir, { recursive: true });
				// console.log('Directory created successfully', dir);
			} catch (err) {
				console.log('failed to create directory', err.message);
			}
		}
	}
}

/**
 *	Return true if filename (string) should be ignored
 */
function ignoreFiles(str) {
	try {
		// hidden files
		if (/^\..*/.test(str)) return true;
		// "_meta" files
		if (/^_/.test(str)) return true;
	} catch (err) {
		console.error(err);
	}
}


main();