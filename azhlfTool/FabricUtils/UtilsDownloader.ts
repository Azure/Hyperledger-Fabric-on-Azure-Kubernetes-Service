import Axios from "axios";
import { createGunzip } from "zlib";
import { join as pathJoin, basename } from "path";
import { extract as extractTar, ExtractOptions } from "tar-fs";
import { Constants } from "./Constants";

async function DownloadFabricBinaries(): Promise<void> {
    const binariesVersion = Constants.binariesVersion;
    const baseUri = `https://github.com/hyperledger/fabric/releases/download/v${binariesVersion}/`;
    const platform = process.platform;
    let downloadUri;
    let folder;

    switch (platform) {
        case "win32":
            downloadUri = baseUri + `hyperledger-fabric-windows-amd64-${binariesVersion}.tar.gz`;
            folder = "windows";
            break;
        case "linux":
            downloadUri = baseUri + `hyperledger-fabric-linux-amd64-${binariesVersion}.tar.gz`;
            folder = "linux";
            break;
        case "darwin":
            downloadUri = baseUri + `hyperledger-fabric-darwin-amd64-${binariesVersion}.tar.gz`;
            folder = "macos";
            break;
        default:
            throw new Error(`Unknown platform ${platform}`);
    }

    console.log(`download fabric binaries for ${folder}`);
    const response = await Axios.get(downloadUri, { responseType: "stream" });

    const binFolder = pathJoin(__dirname, "..", "node_modules", ".bin", `fabric-${binariesVersion}`, folder);
    const extractOptions: ExtractOptions = {
        ignore: name => !name.endsWith("configtxlator"), // extract only configtxlator
        map: header => {
            //flatten hierarchy
            header.name = basename(header.name); // bin/configtxlator => configtxlator
            return header;
        }
    };

    const extract = extractTar(binFolder, extractOptions);

    const downloadPromise = new Promise((resolve, reject) => {
        extract.on("finish", resolve);
        extract.on("error", reject);
    });

    response.data.pipe(createGunzip()).pipe(extract);
    await downloadPromise;
}

DownloadFabricBinaries().catch(error => console.log(error));
