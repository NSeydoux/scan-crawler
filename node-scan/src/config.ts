const tripledoc = require("tripledoc")
const {fetchDocument} = tripledoc;
import {WCMS} from "@nseydoux/vocab-wcms"

interface VolumeInfo {
    volumeNumber: number,
    firstChapter: number,
    lastChapter: number
}

/**
 * Builds an array of VolumeInfo based on RDF properties
 * from the WCMS vocabulary.
 * @param iri 
 */
async function readVolumeMapping(iri: string) : Promise<VolumeInfo[]> {
    const configDoc = await fetchDocument(iri)
    const volumes = configDoc.getAllSubjectsOfType(WCMS.Tome.value)
    console.log(`Retrieved ${volumes.length} volumes`)
    return volumes.map(volume => {
        const volumeNumber: number = volume.getInteger(WCMS.number.value)
        const firstChapter: number = configDoc.getSubject(
            volume.getRef(WCMS.startsAt.value))
            .getInteger(WCMS.number.value)
        const lastChapter: number = configDoc.getSubject(
            volume.getRef(WCMS.endsAt.value))
        .getInteger(WCMS.number.value)
        return {volumeNumber, firstChapter, lastChapter}
    })
}

export {readVolumeMapping, VolumeInfo}