import { Parser, Store, DataFactory } from "n3";
const { namedNode } = DataFactory;
import { WCMS } from "./wcms"
import { debug } from "console";

interface VolumeInfo {
    volumeNumber: number,
    firstChapter: number,
    lastChapter: number
}

async function parseRdf(str: string) {
  const parser = new Parser();
  const data = new Store();
  await new Promise<void>((resolve) => {
    parser.parse(
      str,
      (error, quad) => {
        if (error) {
          throw new Error("Parsing error", error);
        }
        if (quad) {
          data.addQuad(quad);
        } else {
          resolve();
        }
      });
  });
  return data  
}

/**
 * Builds an array of VolumeInfo based on RDF properties
 * from the WCMS vocabulary.
 * @param iri 
 */
async function readVolumeMapping(iri: string) : Promise<VolumeInfo[]> {
    debug(`Fetching config from ${iri}`);
    const config = await fetch(iri)
      .then((response) => { return response.text() })
      .then(parseRdf);
    debug(JSON.stringify(config));
    const volumes = config.match(undefined, namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#"), namedNode(WCMS.Tome));
    return Array.from(volumes)
      .map((q) => q.subject)
      .map((volume) => {
        const volumeNumber = parseInt(
          Array.from(config.match(namedNode(volume.value), namedNode(WCMS.number)))[0].object.value
        );
        const firstChapterSubj = Array.from(config.match(
          namedNode(volume.value), namedNode(WCMS.startsAt), undefined)
        )[0].object.value;
        const firstChapter = parseInt(
          Array.from(config.match(
            namedNode(firstChapterSubj), namedNode(WCMS.number), undefined)
          )[0].object.value
        );
        const lastChapterSubj = Array.from(config.match(
          namedNode(volume.value), namedNode(WCMS.startsAt), undefined)
        )[0].object.value;
        const lastChapter = parseInt(
          Array.from(config.match(
            namedNode(lastChapterSubj), namedNode(WCMS.number), undefined)
          )[0].object.value
        );
        console.log(`Mapping: ${JSON.stringify({ volumeNumber, firstChapter, lastChapter })}`)
        return { volumeNumber, firstChapter, lastChapter };
      })
    // const volumes = configDoc.getAllSubjectsOfType(WCMS.Tome)
    // console.log(`Retrieved ${volumes.length} volumes`)
}

export {readVolumeMapping, VolumeInfo}
