import fetch from "node-fetch"
import {format} from "util"
import {range} from "lodash"
import {basename} from "path"
import {promises as fsPromise, createWriteStream} from "fs"
const {readFile, writeFile, mkdir, unlink, rmdir} = fsPromise
import glob = require("glob")
import JSZip = require("jszip")
import AbortController from 'abort-controller';
import {readVolumeMapping, VolumeInfo} from "./config"

const IRI_TEMPLATE = 'https://img.mghubcdn.com/file/imghub/one-piece/%d/%d.%s';
const MAX_PARALLEL_FETCHES : number = 1;
const PAGES_TO_FETCH : number[] = range(1, MAX_PARALLEL_FETCHES+1);
const DEBUG: boolean = false;
const EXTENSIONS: string[] = ["jpg", "png"]

/**
 * Returns a Promise chain that fetches the page
 * and writes it to a file. Recursively retries on
 * timeout, and recursively tries the different 
 * possible extensions.
 * @param chapter 
 * @param page 
 */
async function fetchPage(volume: number, chapter: number, page: number, extensionsTried: number) {
    // console.log(`Fetching ${format(IRI_TEMPLATE, chapter, page)}`)
    const controller = new AbortController();
    const timeout = setTimeout(
        () => { controller.abort(); },
        5000,
    );
    return fetch(
            format(IRI_TEMPLATE, chapter, page, EXTENSIONS[extensionsTried]),
            { signal: controller.signal }
        ).then(res => {
            if (!res.ok){
                throw Error(`Status ${res.status} on ${chapter}:${page}`)
            }
            return res.buffer()
        })
        .catch(err => {
            if(err.name === 'AbortError'){
                // Retry on timeout
                console.log("Retrying on timeout")
                clearTimeout(timeout);
                return fetchPage(volume, chapter, page, extensionsTried);
            } else if(extensionsTried + 1 < EXTENSIONS.length) {
                return fetchPage(volume, chapter, page, extensionsTried + 1);
            } else {
                throw err
            }
        })
        .then(body => writeFile(`${volume}/${chapter}_${page}.jpg`, body, 'binary'));

}

/**
 * Performs MAX_PARALLEL_FETCHES at a time, until a 
 * fetch fails.
 * @param chapter 
 */
async function fetchChapter(volume: number, chapter: number) {
    console.log(`Fetching chapter ${chapter}`)
    let chapterComplete : boolean = false;
    let pages_to_fetch = PAGES_TO_FETCH.map(x=>x);
    while(!chapterComplete){
        await Promise.all(pages_to_fetch.map(page => fetchPage(volume, chapter, page, 0)))
        .catch(err => {
            chapterComplete = true;
            if (DEBUG) {console.error(err)}
            console.log(`Chapter ${chapter} fetched`)
        })
        pages_to_fetch = pages_to_fetch.map(page => page + MAX_PARALLEL_FETCHES)
    }
}

/**
 * This creates the .cbz archive by browsing
 * the created folder and creating a JSZip
 * archive.
 * @param volume 
 * @param zipper 
 */
async function zipVolume(volume: number) {
    const zip = new JSZip()
    glob(`${volume}/*.jpg`, async (err, files) => {
        if (err) throw err
        // Create a zip with all the files
        await Promise.all(files.map(
            async file => {
                return zip.file(basename(file), await readFile(file))
            }
        ))
        // Delete the zipped files
        Promise.all(files.map(file => unlink(file)))
        .then(() => rmdir(`${volume}`))
        // Write the zip to the filesystem
        zip.generateNodeStream({type:'nodebuffer',streamFiles:true})
        .pipe(createWriteStream(`${volume}.cbz`))
    })
    
}

async function fetchVolume(volumeInfo: VolumeInfo) {
    // First, create the directory
    await mkdir(`${volumeInfo.volumeNumber}`).catch(console.error);
    // Then, fetch all the chapters of the volume
    return Promise.all(
        // range is inclusive for the first param, and exclusive for the second
        range(volumeInfo.firstChapter, volumeInfo.lastChapter+1)
        .map(chapter => fetchChapter(volumeInfo.volumeNumber, chapter))
    // Finally, after all the chapters have been fetched, zip the volume
    ).then(()=>zipVolume(volumeInfo.volumeNumber))
}

async function fetchVolumes(volumesInfo: VolumeInfo[]){
    for (const volumeInfo of volumesInfo) {
        await fetchVolume(volumeInfo)
    }
}

readVolumeMapping("http://localhost:5000/one-piece.ttl")
    .then(fetchVolumes)

// // @ts-ignore
// const root : HTMLElement = htmlParser.parse(body);
// root.querySelectorAll("img")....