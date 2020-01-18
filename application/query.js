/*
 * FILE: query.js
 *
 * DESCRIPTION: Query chaincode
 *
 */

'use strict';

const { FileSystemWallet, Gateway } = require('fabric-network');
const path = require('path');
const fs = require('fs');
var args = require('yargs')
             .usage('Usage: <command> [options]')
             .command('queryCC', 'Perform chaincode query')
             .option({
             'o': {
             alias: 'orgName',
             describe: 'Name of organization',
             type: 'string',
             },
             'u': {
             alias: 'user',
             describe: 'User Identity',
             type: 'string',
             },
             'n': {
             alias: 'name',
             describe: 'Name of the chaincode',
             type: 'string',
             },
             'c': {
             alias: 'channel',
             describe: 'Channel where chaincode is to be queried',
             type: 'string',
             },
             'f': {
             alias: 'func',
             describe: 'Function to be executed',
             type: 'string',
             },
             'a': {
             alias: 'args',
             describe: 'Comma separated list of arguments to the function',
             type: 'string',
             },
             })
             .help('h')
             .alias('h', 'help')
             .argv;

async function main() {
    try {
        var orgName = args.orgName;
        var userId = args.user;
        var channelName = args.channel;
        var ccName = args.name;
        var ccFunc = args.func;
        var ccArgs = args.args;

        if ((orgName === undefined) ||
            (userId === undefined) ||
            (channelName === undefined) ||
            (ccName === undefined) ||
            (ccFunc === undefined) ||
            (ccArgs === undefined)) {
                console.error("Invalid arguments specified!!!!");
                console.error("Execute \'npm run queryCC -- -h\' for help!!!!");
                process.exit(1);
            }

        var ccpFile = orgName + '-ccp.json';
        var ccpPath = path.resolve(__dirname, 'profile', ccpFile);
        var ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        var ccp = JSON.parse(ccpJSON);

        // Create a new file system based wallet for managing identities.
        var walletPath = path.join(process.cwd(), ccp.wallet);
        var wallet = new FileSystemWallet(walletPath);

        // Check to see if we've already enrolled the user.
        var userExists = await wallet.exists(userId);
        if (!userExists) {
            console.log('An identity for' + userId + ' user does not exist in the wallet');
            console.log('Register the user before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        var gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: userId, discovery: { enabled: true, asLocalhost: false } });

        // Set client TLS certificate and key for mutual TLS
        var client = gateway.getClient();
        var userTlsCert = await wallet.export(userId+'-tls');
        client.setTlsClientCertAndKey(userTlsCert.certificate, userTlsCert.privateKey);

        // Get the network (channel) our contract is deployed to.
        var network = await gateway.getNetwork(channelName);

        // Get the contract from the network.
        var contract = network.getContract(ccName);

        // Evaluate the specified transaction.
        // queryCar transaction - requires 1 argument, ex: ('queryCar', 'CAR4')
        // queryAllCars transaction - requires no arguments, ex: ('queryAllCars')
        //const result = await contract.evaluateTransaction('queryAllCars');
        var result = await contract.evaluateTransaction(ccFunc, ccArgs);
        console.log(`Transaction has been evaluated, result is: ${result.toString()}`);

    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        process.exit(1);
    }
}

main();
