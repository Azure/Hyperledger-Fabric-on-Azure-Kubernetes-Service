import { readFile } from "fs-extra";
import { join as joinPath } from "path";

export const ConfigHelper = {
    async getOrganizationConfig(organizationName: string, adminCerts: string[], rootCerts: string[], tlsRootCerts: string[]): Promise<object> {
        // this is test config with common configuration for the organization.
        const orgConfigJson = await readFile(joinPath(__dirname, "..", "..", "configs", "organizationConfig.json"), "utf8");
        const orgJson = orgConfigJson.replace(/!orgName!/g, organizationName);
        const orgConfig = JSON.parse(orgJson);

        orgConfig.values.MSP.value.config.admins = adminCerts.map(cert => Buffer.from(cert).toString("base64"));
        // eslint-disable-next-line @typescript-eslint/camelcase
        orgConfig.values.MSP.value.config.root_certs = rootCerts.map(cert => Buffer.from(cert).toString("base64"));
        // eslint-disable-next-line @typescript-eslint/camelcase
        orgConfig.values.MSP.value.config.tls_root_certs = tlsRootCerts.map(cert => Buffer.from(cert).toString("base64"));

        return orgConfig;
    },

    async getNewAppChannelConfigUpdate(channelName: string, organizationName: string, organizationConfig: object): Promise<object> {
        const newChannelConfigJson = await readFile(joinPath(__dirname, "..", "..", "configs", "newchannelconfig.json"), "utf8");
        const newChannelConfig = JSON.parse(newChannelConfigJson);

        // eslint-disable-next-line @typescript-eslint/camelcase
        newChannelConfig.channel_id = channelName;
        newChannelConfig.read_set.groups.Application.groups = {};
        newChannelConfig.write_set.groups.Application.groups = {};
        newChannelConfig.read_set.groups.Application.groups[`${organizationName}`] = organizationConfig;
        newChannelConfig.write_set.groups.Application.groups[`${organizationName}`] = organizationConfig;

        return newChannelConfig;
    }
};
