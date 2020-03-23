import { join as joinPath } from "path";

export const Constants = {
    SystemChannelName: "testchainid",
    Consortium: "SampleConsortium",
    StoresPath: joinPath(__dirname, "..", "..", "stores")
};