import { promises as fsPromise } from "fs"
const { mkdir } = fsPromise
import { readVolumeMapping, VolumeInfo } from "./config"
import { formatNumber, zipVolume } from "./save"
import { fetchVolume } from "./fetch"
import yargs = require('yargs');

const DEBUG: boolean = false;

interface Arguments {
    id: string;
    configIri: string;
    firstTome: number;
    lastTome: number | undefined;
    oneTome: number | undefined;
  }

async function processVolume(id: string, volume: VolumeInfo): Promise<void> {
    // First, create the directory
    return mkdir(`${formatNumber(volume.volumeNumber)}`)
    .then(() => fetchVolume(id, volume))
    //After all the chapters have been fetched, zip the volume
    .then(() => zipVolume(volume.volumeNumber))
    .catch(console.error);
}

const argv: Arguments = yargs.options({
    id: { type: 'string', describe: 'The manga id', demandOption: true },
    configIri: {type: 'string', describe: 'Where to find the configuration.', demandOption: true},
    firstTome: { type: 'number'},
    lastTome: { type: 'number', default: 9999 },
    oneTome: { type: 'number' },
  }).argv;

if(!argv.firstTome && !argv.oneTome) {
    console.error("Either --firstTome or --oneTome must be set")
    yargs.showHelp("error")
} else {
    readVolumeMapping(argv.configIri)
    .then(async mappings => {
        if(argv.oneTome) {
            argv.firstTome = argv.oneTome;
            argv.lastTome = argv.oneTome;
        }
        for(const mapping of mappings) {
            if(mapping.volumeNumber >= argv.firstTome 
                && mapping.volumeNumber <= argv.lastTome) {
                    await processVolume(argv.id, mapping)
            }
        }
    })
}



// // @ts-ignore
// const root : HTMLElement = htmlParser.parse(body);
// root.querySelectorAll("img")....

export {DEBUG}
