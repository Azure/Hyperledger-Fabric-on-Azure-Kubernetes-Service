/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { FileSystemWallet, X509WalletMixin } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const args = require('yargs')
    .usage('Usage: <command> [options]')
    .command('importAdmin', 'Import Admin user identity in the wallet')
    .option({
    'o': {
    alias: 'orgName',
    describe: 'Name of organization',
    }
    })
    .help('h')
    .alias('h', 'help')
    .argv;

async function main() {
    try {
        //const orgName = process.env.ORGNAME;
        const orgName = args.orgName;
        if (orgName === undefined)
        {
            console.error("Invalid argument passed!!!");
            console.error("Run \'npm run importAdmin -- -h\' for help.");
            process.exit(1);
        }
        const adminProfileFile = orgName + '-admin.json';
        const ccpFile = orgName + '-ccp.json';

        const ccpPath = path.resolve(__dirname, 'profile', ccpFile);
        const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        const ccp = JSON.parse(ccpJSON);

        const adminProfilePath = path.resolve(__dirname, 'profile', adminProfileFile);
        const adminProfileJSON = fs.readFileSync(adminProfilePath, 'utf8');
        const adminProfile = JSON.parse(adminProfileJSON);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), ccp.wallet);
        const wallet = new FileSystemWallet(walletPath);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(adminProfile.name);
        if (userExists) {
            console.log(`An identity for the admin user ${ccp.name} already exists in the wallet`);
            return;
        }

        // Import the new identity into the wallet.
        const certBase64 = new Buffer(adminProfile.cert, 'base64');
        const keyBase64 = new Buffer(adminProfile.private_key, 'base64');
        const adminUserIdentity = X509WalletMixin.createIdentity(adminProfile.msp_id, certBase64.toString('ascii'), keyBase64.toString('ascii'));
        await wallet.import(adminProfile.name, adminUserIdentity);
        
        // Import the new identity into the wallet.
        const tls_certBase64 = new Buffer(adminProfile.tls_cert, 'base64');
        const tls_keyBase64 = new Buffer(adminProfile.tls_private_key, 'base64');
        const adminUserTlsIdentity = X509WalletMixin.createIdentity(adminProfile.msp_id, tls_certBase64.toString('ascii'), tls_keyBase64.toString('ascii'));
        await wallet.import(adminProfile.name+'-tls', adminUserTlsIdentity);
        console.log(`Successfully imported admin user ${adminProfile.name} identity into the wallet`);

    } catch (error) {
        console.error(`Failed to enroll admin user ${adminProfile.name}: ${error}`);
        process.exit(1);
    }
}

main();
