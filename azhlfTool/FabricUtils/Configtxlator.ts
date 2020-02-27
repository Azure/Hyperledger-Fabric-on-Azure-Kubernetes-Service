import { execFileSync, ExecFileSyncOptions } from "child_process";
import { join as joinPath, parse as parsePath } from "path";
import { readFile, mkdtemp, unlink, rmdir, writeFile } from "fs-extra";
import { Constants } from "./Constants";

export enum ProtobuffType {
    CommonConfigenvelope = "common.ConfigEnvelope",
    CommonEnvelope = "common.Envelope",
    CommonConfig = "common.Config",
    CommonConfigupdate = "common.ConfigUpdate"
}

export interface ConfigEnvelope {
    config: object;
}

// wrapper for the configtxlator binaries.
export class Configtxlator {
    public async encode(input: object, type: ProtobuffType): Promise<Buffer> {
        const encoded = await this.encodeDecode(Buffer.from(JSON.stringify(input)), type, true);
        return encoded;
    }

    public async decode<T>(buffer: Buffer, type: ProtobuffType): Promise<T> {
        const decoded = await this.encodeDecode(buffer, type, false);
        return JSON.parse(decoded.toString());
    }

    public async computeUpdate(channelName: string, type: ProtobuffType, original: object, modified: object): Promise<Buffer> {
        const txlatorExecInfo = this.getTxlatorExecInfo();
        const tmpdir = await mkdtemp(joinPath(txlatorExecInfo.txlatorFolder, "tmp"));
        const tmpdirName = parsePath(tmpdir).name;
        const originalFileName = "original.pb";
        const modifiedFileName = "modified.pb";
        const outputFileName = "output.pb";

        const originalBytes = await this.encode(original, type);
        await writeFile(joinPath(tmpdir, originalFileName), originalBytes);

        const modifiedBytes = await this.encode(modified, type);
        await writeFile(joinPath(tmpdir, modifiedFileName), modifiedBytes);

        this.execute(
            `compute_update --channel_id ${channelName} --original ${tmpdirName}/${originalFileName} --updated ${tmpdirName}/${modifiedFileName} --output ${tmpdirName}/${outputFileName}`
        );
        const result = await readFile(joinPath(tmpdir, outputFileName));

        await unlink(joinPath(tmpdir, originalFileName));
        await unlink(joinPath(tmpdir, modifiedFileName));
        await unlink(joinPath(tmpdir, outputFileName));
        await rmdir(tmpdir);

        // returns diff in protobuff format, to decode use await decode(result, ProtobuffType.Common_ConfigUpdate);
        return result;
    }

    private async encodeDecode(input: Buffer, type: ProtobuffType, encode: boolean): Promise<Buffer> {
        const txlatorExecInfo = this.getTxlatorExecInfo();
        const tmpdir = await mkdtemp(joinPath(txlatorExecInfo.txlatorFolder, "tmp"));
        const tmpdirName = parsePath(tmpdir).name;
        const inputFileName = "inputfile";
        const outputFileName = "outputfile";

        await writeFile(joinPath(tmpdir, inputFileName), input);

        const command = encode ? "proto_encode" : "proto_decode";
        this.execute(`${command} --type ${type} --input ${tmpdirName}/${inputFileName} --output ${tmpdirName}/${outputFileName}`);
        const result = await readFile(joinPath(tmpdir, outputFileName));

        await unlink(joinPath(tmpdir, inputFileName));
        await unlink(joinPath(tmpdir, outputFileName));
        await rmdir(tmpdir);
        return result;
    }

    private execute(configtxlatorArgs: string): void {
        const txlatorExecInfo = this.getTxlatorExecInfo();
        const opts: ExecFileSyncOptions = { cwd: txlatorExecInfo.txlatorFolder, windowsHide: true };
        const args = ["-c", `./configtxlator ${configtxlatorArgs}`];
        execFileSync(txlatorExecInfo.shell, args, opts);
    }

    private getTxlatorExecInfo(): { shell: string; txlatorFolder: string } {
        const platform = process.platform;
        let shell: string;
        let txlatorFolder: string;
        if (platform == "win32") {
            shell = "bash.exe";
            txlatorFolder = "windows";
        } else if (platform == "linux") {
            shell = "/bin/bash";
            txlatorFolder = "linux";
        } else if (platform == "darwin") {
            shell = "/bin/bash";
            txlatorFolder = "macos";
        } else {
            throw new Error(`unknown platform ${platform}`);
        }

        txlatorFolder = joinPath(__dirname, "..", "..", "node_modules", ".bin", `fabric-${ Constants.binariesVersion }`, txlatorFolder);
        return { shell, txlatorFolder };
    }
}
