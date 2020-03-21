import fetch from "node-fetch"
import {format} from "util"
import {range} from "lodash"
import {basename} from "path"
import {promises as fsPromise, createWriteStream} from "fs"
const {readFile, writeFile, mkdir, unlink, rmdir} = fsPromise
import glob = require("glob")
import JSZip = require("jszip")

// import {parse} from "node-html-parser"

const IRI_TEMPLATE = 'https://img.mghubcdn.com/file/imghub/one-piece/%d/%d.jpg';
const MAX_PARALLEL_FETCHES : number = 10;
const PAGES_TO_FETCH : number[] = range(1, MAX_PARALLEL_FETCHES+1);

/**
 * Returns a Promise chain that fetches the page
 * and writes it to a file.
 * @param chapter 
 * @param page 
 */
async function fetch_page(volume: number, chapter: number, page: number) {
    console.log(`Fetching ${format(IRI_TEMPLATE, chapter, page)}`)
    return fetch(format(IRI_TEMPLATE, chapter, page))
                .then(res => {
                    if (!res.ok){
                        throw Error(`Status ${res.status} on ${chapter}:${page}`)
                    } 
                    return res.buffer()
                })
                .then(body => writeFile(`${volume}/${chapter}_${page}.jpg`, body, 'binary'));
}

/**
 * Performs MAX_PARALLEL_FETCHES at a time, until a 
 * fetch fails.
 * @param chapter 
 */
async function fetch_chapter(volume: number, chapter: number) {
    console.log(`Fetching chapter ${volume}`)
    let chapterComplete : boolean = false;
    let pages_to_fetch = PAGES_TO_FETCH.map(x=>x);
    while(!chapterComplete){
        console.log(`Fetching pages ${pages_to_fetch}`)
        await Promise.all(pages_to_fetch.map(page => fetch_page(volume, chapter, page)))
        .catch(err => {
            chapterComplete = true;
            console.error(err)
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
async function zip_volume(volume: number) {
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

const VOLUME_MAP : Map<number, [number, number]> = new Map()
VOLUME_MAP.set(1, [1, 3])

async function fetch_volume(volume: number) {
    await mkdir(`${volume}`).catch(console.error);
    await Promise.all(
        // range is inclusive for the first param, and exclusive for the second
        range(VOLUME_MAP.get(volume)[0], VOLUME_MAP.get(volume)[1]+1)
        .map(chapter => fetch_chapter(volume, chapter)))
}

fetch_volume(1)
.then(() => zip_volume(1));


// // @ts-ignore
// const root : HTMLElement = htmlParser.parse(body);
// root.querySelectorAll("img")....