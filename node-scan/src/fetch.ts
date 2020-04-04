import fetch from "node-fetch"
import {format} from "util"
import {range} from "lodash"

import AbortController from 'abort-controller';
import {VolumeInfo} from "./config"
import {savePage} from "./save"

import {DEBUG} from "./index"

const IRI_TEMPLATE = 'https://img.mghubcdn.com/file/imghub/%s/%d/%d.%s';
const MAX_PARALLEL_FETCHES : number = 1;
const PAGES_TO_FETCH : number[] = range(1, MAX_PARALLEL_FETCHES+1);
const EXTENSIONS: string[] = ["jpg", "png"]

interface fetchedPage {
    data: Buffer,
    extension: string
}

/**
 * Returns a Promise chain that fetches the page
 * and writes it to a file. Recursively retries on
 * timeout, and recursively tries the different 
 * possible extensions.
 * @param chapter 
 * @param page 
 */
async function fetchPage(
    id: string, volume: number, chapter: number, 
    page: number, extensionsTried: number
    ) : Promise<fetchedPage> {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => { controller.abort(); },
        5000,
    );
    return fetch(
            format(IRI_TEMPLATE, id, chapter, page, EXTENSIONS[extensionsTried]),
            { signal: controller.signal }
        ).then(res => {
            if (!res.ok){
                throw Error(`Status ${res.status} on ${chapter}:${page}`)
            }
            return res.buffer()
        }).then(buff => { 
            return {data: buff, extension: EXTENSIONS[extensionsTried]}
        }).catch(err => {
            if(err.name === 'AbortError'){
                // Retry on timeout
                console.log("Retrying on timeout")
                clearTimeout(timeout);
                return fetchPage(id, volume, chapter, page, extensionsTried);
            } else if(extensionsTried + 1 < EXTENSIONS.length) {
                return fetchPage(id, volume, chapter, page, extensionsTried + 1);
            } else {
                throw err
            }
        })
}

/**
 * Performs MAX_PARALLEL_FETCHES at a time, until a 
 * fetch fails.
 * @param chapter 
 */
async function fetchChapter(id: string, volume: number, chapter: number) {
    console.log(`Fetching chapter ${chapter}`)
    let chapterComplete : boolean = false;
    let pages_to_fetch = PAGES_TO_FETCH.map(x=>x);
    while(!chapterComplete){
        await Promise.all(
            pages_to_fetch.map(page => 
                fetchPage(id, volume, chapter, page, 0)
                .then(fetchedPage => 
                    savePage(fetchedPage.data, 
                        volume, chapter, page,
                        fetchedPage.extension))))
        .catch(err => {
            chapterComplete = true;
            if (DEBUG) {console.error(err)}
            console.log(`Chapter ${chapter} fetched`)
        })
        pages_to_fetch = pages_to_fetch.map(page => page + MAX_PARALLEL_FETCHES)
    }
}

async function fetchVolume(id: string, volumeInfo: VolumeInfo) {
    // Then, fetch all the chapters of the volume
    return Promise.all(
        // range is inclusive for the first param, and exclusive for the second
        range(volumeInfo.firstChapter, volumeInfo.lastChapter+1)
        .map(chapter => fetchChapter(id, volumeInfo.volumeNumber, chapter))
    )
}

export {fetchVolume}