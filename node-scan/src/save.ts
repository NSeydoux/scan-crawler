import {basename} from "path"
import {promises as fsPromise, createWriteStream} from "fs"
const {readFile, writeFile, mkdir, unlink, rmdir} = fsPromise
import glob = require("glob")
import JSZip = require("jszip")

// Length of numbers when converted to strings
// (padding with '0')
const NUMBER_LENGTH = 4

/**
 * This creates the .cbz archive by browsing
 * the created folder and creating a JSZip
 * archive.
 * @param volume 
 * @param zipper 
 */
async function zipVolume(volume: number) {
    const zip = new JSZip()
    glob(`${formatNumber(volume)}/*`, async (err, files) => {
        if (err) throw err
        // Create a zip with all the files
        await Promise.all(files.map(
            async file => {
                return zip.file(basename(file), await readFile(file))
            }
        ))
        // Delete the zipped files
        Promise.all(files.map(file => unlink(file)))
        .then(() => rmdir(`${formatNumber(volume)}`))
        // Write the zip to the filesystem
        zip.generateNodeStream({type:'nodebuffer',streamFiles:true})
        .pipe(createWriteStream(`${formatNumber(volume)}.cbz`))
    })
}

async function savePage(
    data: Buffer, 
    volume: number, 
    chapter: number, 
    page: number, 
    extension: string): Promise<void> {
    const path = `${
        formatNumber(volume)}/${
        formatNumber(chapter)}_${
        formatNumber(page)}.${
        extension}`
     return writeFile(path, data, 'binary');
}

function formatNumber(num: number) : string {
    return num.toString().padStart(NUMBER_LENGTH, "0")
}

export {savePage, formatNumber, zipVolume};