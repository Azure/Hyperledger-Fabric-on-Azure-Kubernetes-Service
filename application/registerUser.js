/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const args = require('yargs')
    .usage('Usage: <command> [options]')
    .command('registerUser', 'Register and enroll new user identity')
    .option({
    'o': {
    alias: 'orgName',
    describe: 'Name of organization',
    },
    'u': {
    alias: 'user',
    describe: 'Identity for new user',
    }
    })
.help('h')
.alias('h', 'help')
.argv;


async function main() {
    try {
        const orgName = args.orgName;
        const userId = args.user;
        //const orgName = process.env.ORGNAME;
        //const userId = process.env.USER_IDENTITY;

        const ccpFile = orgName + '-ccp.json';
        const ccpPath = path.resolve(__dirname, 'profile', ccpFile);
        const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        const ccp = JSON.parse(ccpJSON);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), ccp.wallet);
        const wallet = new FileSystemWallet(walletPath);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(userId);
        if (userExists) {
            console.log('An identity for the user ' + userId +  ' already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminId  = 'admin.' + orgName;
        const adminExists = await wallet.exists(adminId);
        if (!adminExists) {
            console.log('An identity for admin user ' + adminId + ' does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: adminId, discovery: { enabled: false, asLocalhost: false } });

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        var secret = await ca.register({ enrollmentID: userId, role: 'client' }, adminIdentity);
        var enrollment = await ca.enroll({ enrollmentID: userId, enrollmentSecret: secret });
        var userIdentity = X509WalletMixin.createIdentity(ccp.organizations[orgName].mspid, enrollment.certificate, enrollment.key.toBytes());
        await wallet.import(userId, userIdentity);
        console.log('Successfully registered and enrolled user \'' + userId + '\' and imported it into the wallet');

        secret = await ca.register({ enrollmentID: userId+'.tls', role: 'client' }, adminIdentity);
        enrollment = await ca.enroll({ enrollmentID: userId+'.tls', enrollmentSecret: secret });
        userIdentity = X509WalletMixin.createIdentity(ccp.organizations[orgName].mspid, enrollment.certificate, enrollment.key.toBytes());
        await wallet.import(userId+'-tls', userIdentity);
        console.log('Successfully registered and enrolled user \'' + userId + '\' TLS certificate and imported it into the wallet');
    } catch (error) {
        console.error('Failed to register user: ' + error);
        process.exit(1);
    }
}

main();
