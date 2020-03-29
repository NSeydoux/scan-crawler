import {promises as fsPromise} from "fs"
const {mkdir} = fsPromise
import {readVolumeMapping, VolumeInfo} from "./config"
import {formatNumber, zipVolume} from "./save"
import {fetchVolume} from "./fetch"

const DEBUG: boolean = false;

async function processVolume(volume: VolumeInfo): Promise<void> {
    // First, create the directory
    return mkdir(`${formatNumber(volume.volumeNumber)}`)
    .then(() => fetchVolume(volume))
    //After all the chapters have been fetched, zip the volume
    .then(() => zipVolume(volume.volumeNumber))
    .catch(console.error);
}

readVolumeMapping("http://localhost:5000/one-piece.ttl")
    .then(async mappings => {
        for(const mapping of mappings) {
            await processVolume(mapping)
        }
    })

// // @ts-ignore
// const root : HTMLElement = htmlParser.parse(body);
// root.querySelectorAll("img")....

export {DEBUG}