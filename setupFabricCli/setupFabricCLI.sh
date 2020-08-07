#!/bin/bash

printPeerCommandHelp() {
    echo
    echo "======= Please provide the following arguments correctly (in order): ======="
    echo -e "\tPeer Admin Credentials Path"
    echo -e "\t\t- You can download the Admin Credentials JSON file from Azure Portal UI, by selecting your Blockchain Resource > Overview pane > Admin Credentials."
    echo
    echo -e "\tPeer Connection Profile Path"
    echo -e "\t\t- You can download the Connection Profile JSON file from Azure Portal UI, by selecting your Blockchain Resource > Overview pane > Connection Profile."
    echo
    echo -e "\tPeer MSP Configuration Path"
    echo -e "\t\t- You can download the MSP Configuration JSON file from Azure Portal UI, by selecting your Blockchain Resource > Overview pane > MSP Configuration."
    echo
    echo -e "\tPeer node name: e.g. \"peer<peer#>\""
    echo
    echo -e "\tOrderer Connection Profile Path"
    echo -e "\t\t- You can download the Connection Profile JSON file from Azure Portal UI, by selecting your Blockchain Resource > Overview pane > Connection Profile."
    echo
    echo -e "\tOrderer node name: e.g. \"orderer<orderer#>\""
    echo
    echo "======= Example: ======="
    echo
    peerProfileRootPath=/var/hyperledger/profiles/peerprofiles/peerOrg
    ordererProfileRootPath=/var/hyperledger/profiles/peerprofiles/ordererOrg
    echo -e "\tsource setupFabricCLI.sh \"peer\" ${peerProfileRootPath}/peerOrg_AdminCredential.json ${peerProfileRootPath}/peerOrg_ConnectionProfile.json ${peerProfileRootPath}/peerOrg_MSPConfiguration.json \"peer1\" ${ordererProfileRootPath}/ordererOrg_ConnectionProfile.json \"orderer1\""
    echo
}

printOrdererCommandHelp() {
    echo
    echo "======= Please provide the following arguments correctly (in order): ======="
    echo -e "\tOrderer Admin Credentials Path"
    echo -e "\t\t- You can download the Admin Credentials JSON file from Azure Portal UI, by selecting your Blockchain Resource > Overview pane > Admin Credentials."
    echo
    echo -e "\tOrderer Connection Profile Path"
    echo -e "\t\t- You can download the Connection Profile JSON file from Azure Portal UI, by selecting your Blockchain Resource > Overview pane > Connection Profile."
    echo
    echo -e "\tOrderer MSP Configuration Path"
    echo -e "\t\t- You can download the MSP Configuration JSON file from Azure Portal UI, by selecting your Blockchain Resource > Overview pane > MSP Configuration."
    echo
    echo -e "\tOrderer node name: e.g. \"orderer<orderer#>\""
    echo
    echo "======= Example: ======="
    echo
    ordererProfileRootPath=/var/hyperledger/profiles/ordererprofiles/ordererOrg
    echo -e "\tsource setupFabricCLI.sh \"orderer\" ${ordererProfileRootPath}/ordererOrg_AdminCredential.json ${ordererProfileRootPath}/ordererOrg_ConnectionProfile.json ${ordererProfileRootPath}/ordererOrg_MSPConfiguration.json \"orderer1\""
    echo
}

isFile() {
    if ! [[ "$1" == /* ]]; then
        echo
        echo "The path: \"$1\" is not an absolute path! Please give absolute path to the file!"
        echo
        
        return 1
    elif [ -r "$1" ]; then
        return 0 
    else
        echo
        echo "Unable to find file: $1 or it does not have read access! Please give absolute path to the file!"
        echo
        
        return 1
    fi
}

checkNodeName() {
    node=$(cat $2 | jq '.'$1's."'$3'.'$4'"' | sed 's/grpcs:\/\///g' | tr -d '"')
    if [ "$node" = null ]; then
        echo
        echo "Invalid node name: \"$3\" OR invalid connection profile file for $1 organization: $4!"
        echo

        return 1
    else
        return 0
    fi
}

createOrgMSP() {
    orgName=$1
    adminProfilePath=$2
    connectionProfilePath=$3
    mspProfilePath=$4
    nodeName=$5

    rm -rf ./${nodeType}/${orgName}/*
    mkdir -p ./${nodeType}/${orgName}/msp/{admincerts,cacerts,keystore,signcerts,tlscacerts}
    mkdir -p ./${nodeType}/${orgName}/tls
    
    #admincerts
    cat ${adminProfilePath} | jq '.cert' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/msp/admincerts/cert.pem

    #cacerts
    cat ${mspProfilePath} | jq '.cacerts' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/msp/cacerts/rca.pem

    #tlscacerts
    cat ${connectionProfilePath} | jq '.'$nodeType's."'$nodeName'.'${orgName}'".tlsCACerts.pem' | tr -d '"' | sed 's/\\n/\n/g' > \
    ./${nodeType}/${orgName}/msp/tlscacerts/ca.crt

    #signcerts
    cp ./${nodeType}/${orgName}/msp/admincerts/cert.pem ./${nodeType}/${orgName}/msp/signcerts/cert.pem

    #keystore
    cat ${adminProfilePath} | jq '.private_key' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/msp/keystore/key.pem

    #admin-tls-cert
    cat ${adminProfilePath} | jq '.tls_cert' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/tls/cert.pem

    #admin-tls-key
    cat ${adminProfilePath} | jq '.tls_private_key' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/tls/key.pem
}

createOrdererTLSCA() {
    rm -rf ./orderer/${ordererOrgName}/*
    mkdir -p ./orderer/${ordererOrgName}/msp/tlscacerts

    #tlscacerts
    cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".tlsCACerts.pem' | tr -d '"' | sed 's/\\n/\n/g' > \
    ./orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
}

setEnvVars() {
    orgName=$1
    connectionProfilePath=$2
    nodeName=$3

    export CORE_PEER_LOCALMSPID="${orgName}"
    export CORE_PEER_ADDRESS=$(cat ${connectionProfilePath} | jq '.'$nodeType's."'$nodeName'.'${orgName}'".url' | sed 's/grpcs:\/\///g' | tr -d '"')
    export CORE_PEER_TLS_ENABLED="true"
    export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/${nodeType}/${orgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_TLS_CLIENTAUTHREQUIRED="true"
    export CORE_PEER_TLS_CLIENTCERT_FILE=$(pwd)/${nodeType}/${orgName}/tls/cert.pem
    export CORE_PEER_TLS_CLIENTKEY_FILE=$(pwd)/${nodeType}/${orgName}/tls/key.pem
    export CORE_PEER_TLS_CLIENTROOTCAS_FILES=$(pwd)/${nodeType}/${orgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$(pwd)/${nodeType}/${orgName}/msp

    if [ "${nodeType}" = "peer" ]; then
        ordererConnectionProfilePath=$4
        ordererNodeName=$5
        export ORDERER_ENDPOINT=$(cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".url' | sed 's/grpcs:\/\///g' | tr -d '"')
        export ORDERER_TLS_CERT=$(pwd)/orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
    fi 
}

peerArgsCount=7
ordererArgsCount=5

nodeType=$1
if [ "${nodeType}" = "peer" ]; then
    echo
    echo "======= Configuring environment for your ${nodeType} organization! ======="
    echo

    if [ $# -ne $peerArgsCount ]; then
        echo "Invalid number of arguments while setting up Fabric CLI environment for ${nodeType} organization!"
        printPeerCommandHelp
        return;
    fi

    peerAdminProfilePath=$2
    peerConnectionProfilePath=$3
    peerMSPProfilePath=$4
    peerNodeName=$5
    ordererConnectionProfilePath=$6
    ordererNodeName=$7

    if ! isFile ${peerAdminProfilePath} || ! isFile ${peerConnectionProfilePath} \
    || ! isFile ${peerMSPProfilePath} || ! isFile ${ordererConnectionProfilePath}; then
        printPeerCommandHelp
        return;
    fi

    peerOrgName=$(cat ${peerAdminProfilePath} | jq '.msp_id' | tr -d '"')
    ordererOrgName=$(cat ${ordererConnectionProfilePath} | jq '.name' | tr -d '"')

    if ! checkNodeName ${nodeType} ${peerConnectionProfilePath} ${peerNodeName} ${peerOrgName} \
    || ! checkNodeName "orderer" ${ordererConnectionProfilePath} ${ordererNodeName} ${ordererOrgName}; then
        printPeerCommandHelp
        return;
    fi

    createOrgMSP $peerOrgName $peerAdminProfilePath $peerConnectionProfilePath $peerMSPProfilePath $peerNodeName
    createOrdererTLSCA
    setEnvVars $peerOrgName $peerConnectionProfilePath $peerNodeName $ordererConnectionProfilePath $ordererNodeName

    echo
    echo "======= Successfully configured environment for your ${nodeType} organization! ======="
    echo
elif [ "${nodeType}" = "orderer" ]; then
    echo
    echo "======= Configuring environment for your ${nodeType} organization! ======="
    echo

    if [ $# -ne $ordererArgsCount ]; then
        cho "Invalid number of arguments while setting up Fabric CLI environment for ${nodeType} organization!"
        printOrdererCommandHelp
        return;
    fi

    ordererAdminProfilePath=$2
    ordererConnectionProfilePath=$3
    ordererMSPProfilePath=$4
    ordererNodeName=$5

    if ! isFile ${ordererAdminProfilePath} || ! isFile ${ordererConnectionProfilePath} \
    || ! isFile ${ordererMSPProfilePath}; then
        printOrdererCommandHelp
        return;
    fi

    ordererOrgName=$(cat ${ordererConnectionProfilePath} | jq '.name' | tr -d '"')

    if ! checkNodeName ${nodeType} ${ordererConnectionProfilePath} ${ordererNodeName} ${ordererOrgName}; then
        printOrdererCommandHelp
        return;
    fi

    createOrgMSP $ordererOrgName $ordererAdminProfilePath $ordererConnectionProfilePath $ordererMSPProfilePath $ordererNodeName
    setEnvVars $ordererOrgName $ordererConnectionProfilePath $ordererNodeName

    echo
    echo "======= Successfully configured environment for your ${nodeType} organization! ======="
    echo
else
    echo
    echo "Failed to configure environment for node type: \"${nodeType}\"! Should be either \"peer\" or \"orderer\"!"
    echo
fi
